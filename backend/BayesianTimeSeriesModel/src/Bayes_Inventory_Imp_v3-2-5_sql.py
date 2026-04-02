'''
Program Description:
This program is a Bayesian inference model for demand forecasting using PyMC to create a Bayesian model to forecast 
demand based on the historical data and amount of forecast day. It also gets the sales trend weekly and monthly.

Created by Ratanapara Choorat, since October 30, 2025
v3.2 SQL Edition - 04-02-2026

INPUTS (via Command Line / Backend API):
- ingredient (str):    The name of the ingredient to forecast (e.g., 'Chicken'). Optional if ingredient_id given.
- ingredient_id (int): Exact ingredient ID. Takes priority over name.
- restaurant_id (int): Required. Scopes all queries to a specific restaurant.
- strategy (int):      1 (Conservative), 2 (Balanced), 3 (Aggressive).
- buy_price (float):   Cost per unit to purchase. Falls back to DB cost, then 100.0 THB.
- sell_price (float):  Revenue generated per unit (Menu Price Portion).
- start_date (str):    Forecast window start date (any pandas-parseable format).
- end_date (str):      Forecast window end date (any pandas-parseable format).
- return_chart (flag): If passed, includes chart_data in the JSON output.

Formats:
python src/Bayes_Inventory_Imp_v3-2_sql.py \
    --restaurant_id 1 \
    --ingredient "Chicken" \
    --sell_price 150 \
    --start_date 2026-04-02 \
    --end_date 2026-04-09 \
    --strategy 2 \
    --return_chart

OUTPUTS (Standardized JSON Payload):
- recommendation: Suggested target quantity and exact amount to purchase.
- urgency_score:  A calculated risk score to flag imminent stockouts.
- chart_data:     (only if --return_chart is passed)
    - historical_performance: Actual past usage vs. wasted/shortage quantities.
    - future_view: Predictive upper/lower bounds for the upcoming cycle (anchored to today).
'''

import os
os.environ["PYTENSOR_FLAGS"] = "optimizer_excluding=local_subtensor_merge"

import pandas as pd
import numpy as np
import pymc as pm
import matplotlib.pyplot as plt
from sqlalchemy import create_engine, text
import argparse
import json
import sys
from dotenv import load_dotenv


# ============================================================
# 1. CONFIGURATION
# ============================================================

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)

DB_CONNECTION = os.getenv('DATABASE_URL')
DEVICE        = 'CLOUD'         # 'LOCAL' or 'CLOUD'
MAX_FORECAST_DAYS = 90          # Hard cap to prevent accidental huge forecasts

if not DB_CONNECTION:
    print("[System] ERROR: DATABASE_URL not found in .env file!", file=sys.stderr)
    exit()

try:
    db_engine = create_engine(DB_CONNECTION)
    print("[System] Connected to MySQL Database")
except Exception as e:
    print(f"[System] DB Connection Failed: {e}", file=sys.stderr)
    exit()


# ============================================================
# 2. DATA LAYER
# ============================================================

def get_data_from_sql(restaurant_id, ingredient_name=None, ingredient_id=None):
    """
    Fetch ingredient details and historical daily usage from SQL.

    Priority: ingredient_id > ingredient_name.
    Filters by restaurant_id and is_active = 1.

    Returns:
        (daily_demand, unit, cost, stock, lead_time, ing_id)
        Returns (None, ...) on failure or missing data.
    """
    if ingredient_id is None and ingredient_name is None:
        print("[SQL] ERROR: Provide either ingredient_name or ingredient_id.", file=sys.stderr)
        return None, None, 0, 0, 0, None

    print(f"\n[SQL] Searching for ingredient in restaurant {restaurant_id}...")

    try:
        # --- A. Ingredient lookup ---
        if ingredient_id is not None:
            q_ing = text("""
                SELECT id, name, unit, stock_left
                FROM ingredient
                WHERE id            = :ing_id
                  AND restaurant_id = :restaurant_id
                  AND is_active     = 1
                LIMIT 1;
            """)
            params = {"ing_id": ingredient_id, "restaurant_id": restaurant_id}
        else:
            q_ing = text("""
                SELECT id, name, unit, stock_left
                FROM ingredient
                WHERE name          LIKE :name_pattern
                  AND restaurant_id = :restaurant_id
                  AND is_active     = 1
                LIMIT 1;
            """)
            params = {"name_pattern": f"%{ingredient_name}%", "restaurant_id": restaurant_id}

        with db_engine.connect() as conn:
            df_ing = pd.read_sql(q_ing, con=conn, params=params)

        if df_ing.empty:
            lookup = f"ID={ingredient_id}" if ingredient_id else f"name='{ingredient_name}'"
            print(f"[SQL] Ingredient ({lookup}) not found in restaurant {restaurant_id}.", file=sys.stderr)
            return None, None, 0, 0, 0, None

        ing_id    = int(df_ing.iloc[0]['id'])
        ing_name  = df_ing.iloc[0]['name']
        ing_unit  = df_ing.iloc[0]['unit']
        ing_stock = float(df_ing.iloc[0]['stock_left'])
        ing_cost  = 100.0  # TODO: add cost_per_unit column to ingredient table
        ing_lead  = 2      # TODO: add lead_time_days column to ingredient table

        print(f"   > Found : {ing_name} (ID: {ing_id})")
        print(f"   > Stock : {ing_stock} {ing_unit} | Cost: {ing_cost} THB | Lead: {ing_lead} days")

        # --- B. Daily usage from sales + recipe join ---
        q_usage = text("""
            SELECT
                DATE(S.timestamp)        AS date,
                SUM(S.amount * R.amount) AS daily_usage
            FROM sale_data S
            JOIN recipe    R ON S.menu_id = R.menu_id
            WHERE R.ingredient_id = :ing_id
              AND S.restaurant_id = :restaurant_id
            GROUP BY DATE(S.timestamp)
            ORDER BY date ASC;
        """)

        print("   > Calculating historical usage from Sales & Recipes...")
        with db_engine.connect() as conn:
            df_usage = pd.read_sql(
                q_usage, con=conn,
                params={"ing_id": ing_id, "restaurant_id": restaurant_id}
            )

        if df_usage.empty:
            print("   ⚠️  No sales history found for this ingredient.", file=sys.stderr)
            return None, ing_unit, ing_cost, ing_stock, ing_lead, ing_id

        # --- C. Resample to daily, fill missing days with 0 ---
        df_usage['date'] = pd.to_datetime(df_usage['date'])
        daily_demand = (
            df_usage
            .set_index('date')['daily_usage']
            .resample('D').sum()
            .fillna(0)
        )

        print(f"   > {len(daily_demand)} days of history loaded.")
        return daily_demand, ing_unit, ing_cost, ing_stock, ing_lead, ing_id

    except Exception as e:
        print(f"[SQL] ERROR: {e}", file=sys.stderr)
        return None, None, 0, 0, 0, None


def save_forecast_to_sql(final_payload, ingredient_id, restaurant_id, db_engine):
    """
    Persist forecast results to predict_set and predict tables.

    prediction_type: 1 = daily forecast row, 2 = summary recommendation row
    model:           1 = Conservative, 2 = Balanced, 3 = Aggressive

    Returns:
        predict_set_id (int) on success, None on failure.
    """
    if "chart_data" not in final_payload:
        print("[SQL] WARNING: chart_data missing from payload — skipping DB save.", file=sys.stderr)
        return None

    strategy_to_model = {'Conservative': 1, 'Balanced': 2, 'Aggressive': 3}
    rec         = final_payload["recommendation"]
    future_view = final_payload["chart_data"]["future_view"]
    model_int   = strategy_to_model.get(rec["strategy_used"], 2)
    now         = pd.Timestamp.now()

    try:
        with db_engine.begin() as conn:

            # 1. Insert forecast run header
            result = conn.execute(
                text("""
                    INSERT INTO predict_set (timestamp, model, day_ahead)
                    VALUES (:timestamp, :model, :day_ahead)
                """),
                {
                    "timestamp": now,
                    "model":     model_int,
                    "day_ahead": len(future_view)
                }
            )
            predict_set_id = result.lastrowid
            print(f"[SQL] Created PredictSet ID: {predict_set_id}")

            # 2. Insert daily forecast rows (prediction_type = 1)
            # timestamp here is the forecasted DATE (not run time)
            daily_rows = [
                {
                    "ingredient_id":        ingredient_id,
                    "prediction_type":      1,
                    "expected_usage":       round(day["mean_demand"], 2),
                    "upper_bound":          round(day["likely_high_bound_95th"], 2),
                    "lower_bound":          round(day["likely_low_bound_5th"], 2),
                    "daily_target_average": None,
                    "prediction_set":       predict_set_id,
                    "restaurant_id":        restaurant_id,
                    "timestamp":            pd.Timestamp(day["date"])  # future date e.g. 2026-04-03
                }
                for day in future_view
            ]
            conn.execute(
                text("""
                    INSERT INTO predict
                        (ingredient_id, prediction_type, expected_usage,
                         upper_bound, lower_bound, daily_target_average,
                         prediction_set, restaurant_id, timestamp)
                    VALUES
                        (:ingredient_id, :prediction_type, :expected_usage,
                         :upper_bound, :lower_bound, :daily_target_average,
                         :prediction_set, :restaurant_id, :timestamp)
                """),
                daily_rows
            )
            print(f"[SQL] Inserted {len(daily_rows)} daily forecast rows.")

            # 3. Insert summary row (prediction_type = 2) — timestamp = run time
            daily_target_avg = round(rec["expected_usage"] / len(future_view), 2) if future_view else None
            conn.execute(
                text("""
                    INSERT INTO predict
                        (ingredient_id, prediction_type, expected_usage,
                         upper_bound, lower_bound, daily_target_average,
                         prediction_set, restaurant_id, timestamp)
                    VALUES
                        (:ingredient_id, :prediction_type, :expected_usage,
                         :upper_bound, :lower_bound, :daily_target_average,
                         :prediction_set, :restaurant_id, :timestamp)
                """),
                {
                    "ingredient_id":        ingredient_id,
                    "prediction_type":      2,
                    "expected_usage":       float(rec["expected_usage"]),
                    "upper_bound":          None,
                    "lower_bound":          None,
                    "daily_target_average": daily_target_avg,
                    "prediction_set":       predict_set_id,
                    "restaurant_id":        restaurant_id,
                    "timestamp":            now  # run time
                }
            )
            print("[SQL] Inserted summary recommendation row.")

        print(f"[SQL] Save complete for PredictSet {predict_set_id}.")
        return predict_set_id

    except Exception as e:
        print(f"[SQL] ERROR saving forecast: {e}", file=sys.stderr)
        return None


# ============================================================
# 3. BAYESIAN MODEL
# ============================================================

def run_bayesian_forecast(historical, forecast_days):
    """LOCAL mode: 4 chains x 2000 samples. Higher accuracy, slower."""
    print(f"\n--- Running Bayesian Forecast (LOCAL) for next {forecast_days} days ---")
    return _run_model(historical, forecast_days, draws=2000, tune=1000, cores=4, chains=4)


def run_bayesian_forecast_cloud(historical, forecast_days):
    """CLOUD mode: 1 chain x 500 samples. Faster, suitable for Linodes."""
    print(f"\n--- Running Bayesian Forecast (CLOUD) for next {forecast_days} days ---")
    return _run_model(historical, forecast_days, draws=500, tune=500, cores=1, chains=1)


def _run_model(historical, forecast_days, draws, tune, cores, chains):
    """
    Shared PyMC model logic for both LOCAL and CLOUD modes.
    Trend + Weekly Seasonality + Monthly Seasonality.
    """
    days_weeks    = historical.index
    demand_values = historical.values.astype(np.float64)
    data_mean     = np.mean(demand_values)
    data_std      = np.std(demand_values) + 1e-3

    days_index  = np.array(days_weeks.dayofweek, dtype=np.int32)
    month_index = np.array(days_weeks.month - 1,  dtype=np.int32)

    last_date         = days_weeks[-1]
    future_dates      = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=forecast_days, freq='D')
    future_day_idxs   = np.array([d.dayofweek for d in future_dates])
    future_month_idxs = np.array([d.month - 1  for d in future_dates])

    with pm.Model():
        sigma_trend = pm.HalfNormal('sigma_trend', sigma=data_std * 0.1)
        trend       = pm.GaussianRandomWalk('trend', sigma=sigma_trend, shape=len(demand_values),
                                            init_dist=pm.Normal.dist(data_mean, data_std))

        weekly_seasonality  = pm.Normal('weekly_seasonality',  mu=0, sigma=data_std, shape=7)
        monthly_seasonality = pm.Normal('monthly_seasonality', mu=0, sigma=data_std, shape=12)

        expected_demand = trend + weekly_seasonality[days_index] + monthly_seasonality[month_index]
        sigma           = pm.HalfNormal('sigma', sigma=data_std)

        pm.TruncatedNormal('demand_data', mu=expected_demand, sigma=sigma, lower=0.0, observed=demand_values)

        print("\n--- Sampling the Posterior... ---")
        trace = pm.sample(draws, tune=tune, cores=cores, chains=chains, target_accept=0.95, progressbar=True)
        pm.sample_posterior_predictive(trace, extend_inferencedata=True)

    print("\n--- Generating Forecast Scenarios... ---")
    n_draws         = 1000
    forecast_matrix = np.zeros((n_draws, forecast_days))

    trends       = trace.posterior['trend'].values.reshape(-1, len(demand_values))
    week_effs    = trace.posterior['weekly_seasonality'].values.reshape(-1, 7)
    month_effs   = trace.posterior['monthly_seasonality'].values.reshape(-1, 12)
    sigmas       = trace.posterior['sigma'].values.flatten()
    draw_indices = np.random.choice(len(sigmas), n_draws)

    for i, idx in enumerate(draw_indices):
        base_trend        = trends[idx, -1]
        future_week_eff   = week_effs[idx,  future_day_idxs]
        future_month_eff  = month_effs[idx, future_month_idxs]
        noise             = np.random.normal(0, sigmas[idx], size=forecast_days)
        forecast_matrix[i, :] = np.maximum(0, base_trend + future_week_eff + future_month_eff + noise)

    return forecast_matrix, trace


# ============================================================
# 4. OPTIMIZATION
# ============================================================

def optimal_quantity_financial(forecast_matrix, buy_price, sell_price, strategy='balanced'):
    """
    Newsvendor model to find the optimal order quantity.
    strategy: 'conservative' | 'balanced' | 'aggressive'
    """
    print(f"\n--- Optimizing (Buy: {buy_price} THB, Sell: {sell_price} THB, Strategy: {strategy}) ---")

    Co = buy_price
    Cu = max(0.1, sell_price - buy_price)

    if strategy == 'aggressive':
        Cu *= 1.5
        print(">> Prioritizing Availability (Risking Waste)")
    elif strategy == 'conservative':
        Co *= 1.5
        print(">> Prioritizing Cash Flow (Risking Stockouts)")
    else:
        print(">> Standard Economic Optimization")

    total_demand = forecast_matrix.sum(axis=1)
    min_q, max_q = int(total_demand.min()), int(total_demand.max())

    if min_q >= max_q:
        return min_q

    possible_quantities = np.arange(min_q, max_q + 1)
    demands  = total_demand[:, np.newaxis]
    orders   = possible_quantities[np.newaxis, :]
    overage  = np.maximum(0, orders - demands)
    underage = np.maximum(0, demands - orders)

    expected_strategic_loss = (overage * Co) + (underage * Cu)
    best_index = np.argmin(expected_strategic_loss.mean(axis=0))
    optimal_q  = possible_quantities[best_index]

    real_loss     = ((overage * buy_price) + (underage * sell_price)).mean(axis=0)
    min_loss_baht = real_loss[best_index]

    print(f"--- Optimization Done: Recommending {optimal_q} units ---")
    print(f"--- Estimated Financial Risk: {min_loss_baht:.2f} THB ---")

    return optimal_q


# ============================================================
# 5. CHART / OUTPUT HELPERS
# ============================================================

def chart_data_json(historical_demand, forecast_dist, reorder_period, db_stock):
    """
    Build chart payload for the frontend HCD dashboard.

    future_view dates are anchored to TODAY, not the last sale date.
    This prevents stale data from old sales pushing forecasts into the past.

    Returns:
        {
            "historical_performance": [...],  # last reorder_period days of actual sales
            "future_view": [...]              # next reorder_period days from today
        }
    """
    today       = pd.Timestamp.today().normalize()
    last_date   = historical_demand.index.max()

    # Always forecast starting from today, even if last sale was months ago
    anchor_date    = max(last_date, today)
    forecast_dates = pd.to_datetime([
        anchor_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)
    ])

    # --- Future view ---
    value_days  = np.moveaxis(forecast_dist, -1, 0)
    future_list = [
        {
            "date":                   forecast_dates[i].strftime('%Y-%m-%d'),
            "mean_demand":            float(np.mean(day_vals.flatten())),
            "likely_low_bound_5th":   float(np.percentile(day_vals.flatten(), 5)),
            "likely_high_bound_95th": float(np.percentile(day_vals.flatten(), 95))
        }
        for i, day_vals in enumerate(value_days)
    ]

    # --- Historical performance (reverse-simulate stock levels) ---
    recent_history  = historical_demand.iloc[-reorder_period:]
    rev_demand      = recent_history.values[::-1]
    dates_rev       = recent_history.index[::-1]
    hist_stock      = float(db_stock)
    historical_list = []

    for i in range(len(rev_demand)):
        u = float(rev_demand[i])
        historical_list.append({
            "date":                  dates_rev[i].strftime('%Y-%m-%d'),
            "actual_usage":          u,
            "current_stock_at_time": round(hist_stock, 2),
            "waste_shortage_qty":    round(hist_stock - u, 2)
        })
        hist_stock += u

    historical_list.reverse()

    return {
        "historical_performance": historical_list,
        "future_view":            future_list
    }


def plot_forecast_results_explained(historical_demand, forecast_dist, optimal_order,
                                     ingredient_name, reorder_period, unit, db_stock, lead_time):
    """LOCAL debug only — renders matplotlib dashboard."""
    print("\n--- Generating HCD Dashboard ---")

    today       = pd.Timestamp.today().normalize()
    last_date   = historical_demand.index.max()
    anchor_date = max(last_date, today)

    forecast_dates = pd.to_datetime([
        anchor_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)
    ])

    high_bound, mean_vals = [], []
    for day_vals in np.moveaxis(forecast_dist, -1, 0):
        flat = day_vals.flatten()
        high_bound.append(np.percentile(flat, 95))
        mean_vals.append(np.mean(flat))

    projected_inventory = []
    current_inv = float(db_stock)
    for demand in mean_vals:
        current_inv -= demand
        projected_inventory.append(current_inv)

    recent_history = historical_demand.iloc[-30:]
    past_stock_levels, current_calc_stock = [], float(db_stock)
    for u in recent_history.values[::-1]:
        past_stock_levels.append(current_calc_stock)
        current_calc_stock += u
    past_stock_levels.reverse()

    stock_arr = np.array(past_stock_levels)
    usage_arr = recent_history.values

    fig, (ax_hist, ax_fut) = plt.subplots(1, 2, figsize=(16, 6), gridspec_kw={'width_ratios': [1, 1.5]})
    fig.suptitle(f'Inventory Dashboard: {ingredient_name.title()}', fontsize=18, fontweight='bold')

    ax_hist.step(recent_history.index, past_stock_levels, where='mid', color='#a0c4df', linewidth=2, label='Historical Stock')
    ax_hist.plot(recent_history.index, recent_history.values, color='#444444', linewidth=2, label='Actual Usage')
    ax_hist.fill_between(recent_history.index, usage_arr, stock_arr, step='mid',
                         where=(stock_arr >= usage_arr), color='#a0c4df', alpha=0.15, label='Safe Excess')
    ax_hist.fill_between(recent_history.index, usage_arr, stock_arr, step='mid',
                         where=(stock_arr < usage_arr), color='#ff0000', alpha=0.4, label='Stock Deficit')
    ax_hist.set_title('Past 30 Days: Stock vs. Usage', fontsize=12)
    ax_hist.set_ylabel(f'Quantity ({unit})')
    ax_hist.tick_params(axis='x', rotation=45)
    ax_hist.legend(loc='upper right')

    proj_stock_arr = np.array(projected_inventory)
    high_bound_arr = np.array(high_bound)
    initial_stock  = float(db_stock)

    cond_red    = (proj_stock_arr <= 0.10 * initial_stock) | (proj_stock_arr <= high_bound_arr * 1.10)
    cond_orange = ((proj_stock_arr <= 0.25 * initial_stock) | (proj_stock_arr <= high_bound_arr * 1.25)) & ~cond_red
    cond_green  = ~(cond_red | cond_orange)

    ax_fut.step(forecast_dates, proj_stock_arr, where='mid', color='#1f77b4', linewidth=3, label='Projected Stock')
    ax_fut.plot(forecast_dates, high_bound_arr, color='#ff8c00', linestyle='--', linewidth=2, label='95% Demand Upper Limit')
    ax_fut.fill_between(forecast_dates, high_bound_arr, proj_stock_arr, step='mid', where=cond_green,  color='#2ca02c', alpha=0.15, label='Stable')
    ax_fut.fill_between(forecast_dates, high_bound_arr, proj_stock_arr, step='mid', where=cond_orange, color='#ff7f0e', alpha=0.25, label='Restock')
    ax_fut.fill_between(forecast_dates, high_bound_arr, proj_stock_arr, step='mid', where=cond_red,    color='#d62728', alpha=0.40, label='Critical')

    for i in range(len(proj_stock_arr)):
        if proj_stock_arr[i] <= high_bound_arr[i]:
            ax_fut.plot(forecast_dates[i], proj_stock_arr[i], marker='o', color='#ff0000', markersize=10, zorder=5)
            ax_fut.text(forecast_dates[i], proj_stock_arr[i] + (initial_stock * 0.05), ' CRITICAL RISK',
                        color='#ff0000', fontweight='bold')
            break

    ax_fut.axhline(0, color='black', linewidth=1)
    ax_fut.set_title(f'Next {reorder_period} Days: Supply Decay vs Likely Demand', fontsize=12)
    ax_fut.tick_params(axis='x', rotation=45)
    ax_fut.legend(loc='upper right')
    plt.tight_layout()
    plt.show()


# ============================================================
# 6. MAIN PIPELINE FUNCTION
# ============================================================

def run_forecast_job(
    restaurant_id:   int,
    sell_price:      float,
    start_date:      str,
    end_date:        str,
    strategy:        str   = "2",
    ingredient_name: str   = None,
    ingredient_id:   int   = None,
    buy_price:       float = None,
    save_to_db:      bool  = True,
    plot:            bool  = False,
    return_chart:    bool  = False,
) -> dict:
    """
    Full Bayesian forecasting pipeline. Callable from API, Celery, or CLI.

    Args:
        restaurant_id:   Required. Scopes all DB queries.
        sell_price:      Required. Revenue per unit sold.
        start_date:      Forecast window start (pandas-parseable string).
        end_date:        Forecast window end (pandas-parseable string).
        strategy:        "1" Conservative | "2" Balanced | "3" Aggressive.
        ingredient_name: Partial name search. Used if ingredient_id not given.
        ingredient_id:   Exact ID lookup. Takes priority over name.
        buy_price:       Cost override. Falls back to DB cost, then 100.0 THB.
        save_to_db:      Persist results to predict_set + predict tables.
        plot:            Render matplotlib dashboard (LOCAL only).
        return_chart:    Include chart_data in the returned payload.

    Returns:
        dict: Final JSON payload, or {"error": "..."} on failure.
    """

    # --- Guards ---
    if ingredient_name is None and ingredient_id is None:
        return {"error": "Provide either ingredient_name or ingredient_id."}

    try:
        start_dt = pd.to_datetime(start_date)
        end_dt   = pd.to_datetime(end_date)
        today    = pd.Timestamp.today().normalize()

        # Clamp start to today — can't forecast the past
        effective_start = max(start_dt, today)
        reorder_period  = (end_dt - effective_start).days

        if reorder_period <= 0:
            return {"error": "End date must be in the future and after start date."}

        if reorder_period > MAX_FORECAST_DAYS:
            return {"error": f"Forecast window too large ({reorder_period} days). Maximum is {MAX_FORECAST_DAYS} days."}

    except Exception as e:
        return {"error": f"Failed to parse dates: {e}"}

    print(f"[SYSTEM] Starting forecast job — {reorder_period} days for restaurant {restaurant_id}...", file=sys.stderr)

    # --- 1. Fetch data ---
    daily_demand, unit, db_cost, db_stock, lead_time, ing_id = get_data_from_sql(
        restaurant_id=restaurant_id,
        ingredient_name=ingredient_name,
        ingredient_id=ingredient_id,
    )

    if daily_demand is None or daily_demand.empty:
        return {"error": "No historical demand data found for the given ingredient."}
    if len(daily_demand) < 3:
        return {"error": "Insufficient historical data (minimum 3 days required) for forecasting."}

    # --- 2. Setup ---
    strategy_map       = {'1': 'conservative', '2': 'balanced', '3': 'aggressive'}
    selected_strat     = strategy_map.get(strategy, 'balanced')
    resolved_buy_price = buy_price if buy_price else (db_cost if db_cost > 0 else 100.0)

    # --- 3. Run forecast ---
    effective_forecast_amt = reorder_period + lead_time

    if DEVICE == 'CLOUD':
        raw_forecast_dist, trace = run_bayesian_forecast_cloud(daily_demand, effective_forecast_amt)
    else:
        raw_forecast_dist, trace = run_bayesian_forecast(daily_demand, effective_forecast_amt)

    # --- 4. Optimize (post-lead-time window) ---
    forecasted_dist_shift = raw_forecast_dist[:, lead_time:]
    optimal_order = optimal_quantity_financial(
        forecasted_dist_shift, resolved_buy_price, sell_price, strategy=selected_strat
    )

    # --- 5. UI slice (days 1 → reorder_period) ---
    forecast_dist_ui = raw_forecast_dist[:, :reorder_period]

    # --- 6. Final order quantity ---
    expected_lead_time_demand   = float(np.mean(raw_forecast_dist[:, :lead_time].sum(axis=1)))
    projected_stock_at_delivery = max(0, float(db_stock) - expected_lead_time_demand)
    optimal_order_buffered      = int(optimal_order * 1.1)
    final_order                 = max(0, int(optimal_order_buffered - projected_stock_at_delivery))

    # --- 7. Risk metrics ---
    mean_total_demand_ui = float(np.mean(forecast_dist_ui.sum(axis=-1)))
    mean_daily_demand    = mean_total_demand_ui / reorder_period
    days_of_coverage     = float(db_stock) / mean_daily_demand if mean_daily_demand > 0 else 999.0
    risk_priority        = "High" if days_of_coverage < lead_time else "Normal"

    # --- 8. Stockout detection ---
    mean_daily_forecast = forecast_dist_ui.mean(axis=0)
    current_inv         = float(db_stock)
    stockout_day_idx    = -1
    for d in range(reorder_period):
        current_inv -= mean_daily_forecast[d]
        if current_inv <= 0 and stockout_day_idx == -1:
            stockout_day_idx = d

    # --- 9. Status classification ---
    if stockout_day_idx != -1 and stockout_day_idx <= lead_time:
        urgency_score    = 100
        inventory_status = "CRITICAL"
    elif optimal_order > db_stock:
        urgency_score    = min(99, int((lead_time / max(0.1, days_of_coverage)) * 100))
        inventory_status = "REORDER"
    else:
        urgency_score    = 0
        inventory_status = "STABLE"

    # --- 10. Build payload ---
    final_payload = {
        "ingredient_name": ingredient_name or f"ID:{ing_id}",
        "risk_priority":   risk_priority,
        "recommendation": {
            "optimal_target_qty": optimal_order_buffered,
            "current_stock":      float(db_stock),
            "to_purchase_qty":    final_order,
            "urgency_score":      urgency_score,
            "inventory_status":   inventory_status,
            "days_of_coverage":   round(days_of_coverage, 1),
            "lead_time_days":     lead_time,
            "expected_usage":     int(mean_total_demand_ui),
            "strategy_used":      selected_strat.title(),
            "unit":               unit
        }
    }

    # --- 11. Chart data (opt-in) ---
    if return_chart:
        final_payload["chart_data"] = chart_data_json(
            daily_demand, forecast_dist_ui, reorder_period, db_stock
        )

    # --- 12. Plot (LOCAL debug only) ---
    if plot:
        plot_forecast_results_explained(
            daily_demand, forecast_dist_ui, optimal_order,
            ingredient_name or str(ing_id), reorder_period, unit, db_stock, lead_time
        )

    # --- 13. Save to DB ---
    if save_to_db:
        if not return_chart:
            # chart_data needed to build daily rows — generate temporarily
            final_payload["chart_data"] = chart_data_json(
                daily_demand, forecast_dist_ui, reorder_period, db_stock
            )
        save_forecast_to_sql(final_payload, ing_id, restaurant_id, db_engine)
        if not return_chart:
            del final_payload["chart_data"]

    return final_payload


# ============================================================
# 7. CLI ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Munchbox Bayesian Forecaster v3.2")
    parser.add_argument("--ingredient",    type=str,   default=None,         help="Ingredient name (partial match)")
    parser.add_argument("--ingredient_id", type=int,   default=None,         help="Exact ingredient ID")
    parser.add_argument("--restaurant_id", type=int,   required=True,        help="Restaurant ID")
    parser.add_argument("--buy_price",     type=float, default=None,         help="Override DB cost per unit")
    parser.add_argument("--sell_price",    type=float, required=True,        help="Revenue per unit sold")
    parser.add_argument("--start_date",    type=str,   default=None,         help="Forecast start date (default: today)")
    parser.add_argument("--end_date",      type=str,   default=None,         help="Forecast end date (default: today+7)")
    parser.add_argument("--strategy",      type=str,   default="2",          help="1=Conservative 2=Balanced 3=Aggressive")
    parser.add_argument("--return_chart",  action="store_true", default=False, help="Include chart_data in output")
    args = parser.parse_args()

    if args.ingredient is None and args.ingredient_id is None:
        print(json.dumps({"error": "Provide --ingredient or --ingredient_id"}))
        exit()

    # Default dates if not provided
    today     = pd.Timestamp.today().normalize()
    start_date = args.start_date or today.strftime('%Y-%m-%d')
    end_date   = args.end_date   or (today + pd.Timedelta(days=7)).strftime('%Y-%m-%d')

    result = run_forecast_job(
        restaurant_id=args.restaurant_id,
        sell_price=args.sell_price,
        start_date=start_date,
        end_date=end_date,
        strategy=args.strategy,
        ingredient_name=args.ingredient,
        ingredient_id=args.ingredient_id,
        buy_price=args.buy_price,
        save_to_db=True,
        plot=(DEVICE == 'LOCAL'),
        return_chart=args.return_chart,
    )

    print(json.dumps(result, indent=2))

    if "error" not in result:
        with open("forecast_output.json", "w") as f:
            json.dump(result, f, indent=2)