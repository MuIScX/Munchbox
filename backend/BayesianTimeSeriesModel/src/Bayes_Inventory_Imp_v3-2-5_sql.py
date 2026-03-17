'''
Program Description:
This program is a Bayesian inference model for demand forecasting using PyMC to create a Bayesian model to forecast 
demand based on the historical data and amount of forecast day. It also gets the sales trend weekly and monthly.

Created by Ratanapara Choorat, since October 30, 2025
v3.0 SQL Edition - 02-19-2026

'''

import os
# Fix issue of PyTensor overflow error
os.environ["PYTENSOR_FLAGS"] = "optimizer_excluding=local_subtensor_merge"

### Necessary Library for Bayesian Inference
import pandas as pd
import numpy as np
import pymc as pm
import gc # Garbage Collection for memory management
import matplotlib.pyplot as plt
import re # For string operations
from sqlalchemy import create_engine, text # For SQL database connection
import argparse # NEW: For backend command-line arguments
import json     # NEW: For outputting the final payload
import sys      # NEW: To separate logs from the JSON output
from dotenv import load_dotenv



# --- 1. CONFIGURATION ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path)
DB_CONNECTION = os.getenv('DATABASE_URL')
DEVICE = 'CLOUD' # 'LOCAL' for laptops or 'CLOUD' for Cloud Implementation system like Linodes

# Connect to the database
# If its not able to do so, kill the program so we don't mess up the database 

if not DB_CONNECTION: # Check the connection just incase.
    print(" [System] ERROR: DATABASE_URL not found in .env file!", file=sys.stderr)
    exit()

try:
    db_engine = create_engine(DB_CONNECTION)
    print(" [System] Connected to MySQL Database")
except Exception as e:
    print(f" [System] DB Connection Failed: {e}")
    exit()

# --- 2. CORE FUNCTIONS ---

def get_data_from_sql(ingredient_name_query):
    """
    Grabbing the daily usage directly from SQL now.
    ingredient_name_query: the name of the ingredient to search for
    """
    print(f"\n[SQL] Searching for '{ingredient_name_query}'...")
    
    # A. First, find the Ingredient ID and details
    # Using wildcards %% so if I type 'chicken' it finds 'Chicken Breast'
    q_ing = f"""
    SELECT id, name, unit, stock_left
    FROM ingredient 
    WHERE name LIKE '%%{ingredient_name_query}%%' 
    LIMIT 1;
    """
    
    try:
        df_ing = pd.read_sql(q_ing, con=db_engine)
        
        if df_ing.empty:
            print(f"Ingredient '{ingredient_name_query}' not found in database.")
            return None, None, 0, 0, 0
            
        # Extract the stuff we need
        ing_id = df_ing.iloc[0]['id']
        ing_name = df_ing.iloc[0]['name']
        ing_unit = df_ing.iloc[0]['unit']
        #ing_cost = float(df_ing.iloc[0]['cost_per_unit'])
        ing_cost = 100.0 
        ing_stock = float(df_ing.iloc[0]['stock_left'])
        #ing_lead_time = float(df_ing.iloc[0]['lead_time_days'])
        ing_lead_time = 2
        
        print(f"   > Found: {ing_name} (ID: {ing_id})")
        print(f"   > Stock: {ing_stock} {ing_unit} | Cost: {ing_cost} THB")
        print(f"   > Lead Time: {ing_lead_time} days")

        # B. Calculate Daily Usage (The Heavy Lifting)
        # Joining Sales -> Recipe -> Ingredient to see how much we actually used per day
        q_usage = f"""
        SELECT 
            DATE(S.timestamp) as date,
            SUM(S.amount * R.amount) as daily_usage
        FROM sale_data S
        JOIN recipe R ON S.menu_id = R.menu_id
        WHERE R.ingredient_id = {ing_id}
        GROUP BY DATE(S.timestamp)
        ORDER BY date ASC;
        """
        
        print("   > Calculating historical usage from Sales & Recipes...")
        df_usage = pd.read_sql(q_usage, con=db_engine)
        
        if df_usage.empty:
            print("   ⚠️ No sales history found for this ingredient.")
            return None, ing_unit, ing_cost, ing_stock, ing_lead_time

        # C. Format it for the model
        df_usage['date'] = pd.to_datetime(df_usage['date'])
        daily_demand = df_usage.set_index('date')['daily_usage'].resample('D').sum().fillna(0)
        
        return daily_demand, ing_unit, ing_cost, ing_stock, ing_lead_time

    except Exception as e:
        print(f"❌ SQL Error: {e}")
        return None, None, 0, 0, 0


def run_bayesian_forecast(historical, forecast_days):
    """
    Create a Bayesian model to forecast demand based on the historical data and amount of forecast day
    this also getting the sales trend weekly and monthly

    historical: the historical demand data
    forecast_days: the amount of days to forecast
    """
    print(f"\n--- Running Bayesian Forecast for next {forecast_days} day ---")
    # Prep data for PyMC
    days_weeks = historical.index
    demand_values = historical.values

    # The calibration -> Scale the prior based on the data
    data_mean = np.mean(demand_values)
    data_std = np.std(demand_values) + 1e-3 # buffer to avoid zero std

    # Extract the time features
    days_index = np.array(days_weeks.dayofweek, dtype=np.int32) # from 0-6 
    month_index = np.array(days_weeks.month - 1, dtype=np.int32) # from 0-11

    # Future times to represent the future dates
    last_date = days_weeks[-1]
    
    # Note: We don't need the full date range object, just the indices for the lookup
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=forecast_days, freq='D')
    future_day_idxs = np.array([d.dayofweek for d in future_dates])
    future_month_idxs = np.array([d.month - 1 for d in future_dates])

    with pm.Model() as forecast_model:
        # Trends Component, letting baseline shifts overtime based on the data
        # We init_dist at data_mean, so this ACTS as the baseline
        sigma_trend = pm.HalfNormal('sigma_trend', sigma=data_std * 0.1)
        trend = pm.GaussianRandomWalk('trend', sigma=sigma_trend, shape=len(demand_values),
                                      init_dist=pm.Normal.dist(data_mean, data_std))

        # Weekly Seasonality Component
        weekly_seasonality = pm.Normal('weekly_seasonality', mu=0, sigma=data_std, shape=7)

        # Monthly Seasonality Component
        monthly_seasonality = pm.Normal('monthly_seasonality', mu=0, sigma=data_std, shape=12)

        # Expected Demand
        # Math Formula => Demand = Trend + Weekly Seasonality + Monthly Seasonality 
        # (Removed 'baseline' variable as it was undefined and redundant with 'trend')
        expected_demand = trend + weekly_seasonality[days_index] + monthly_seasonality[month_index]

        # Observed Noise Component
        sigma = pm.HalfNormal('sigma', sigma=data_std)

        # Likelihood (How likely is the data given the model from the observations)
        # Math Formula => Demand = Expected Demand + Noise
        demand_data = pm.TruncatedNormal('demand_data', mu=expected_demand, sigma=sigma, lower=0.0, observed=demand_values)

        # Inference/Posterior (What is the most likely model given the data)
        print("\n--- Sampling the Posterior... ---")
        trace = pm.sample(2000, tune=1000, cores=4, chains=4, target_accept=0.95, progressbar=True)

        # Posterior Predictive
        pm.sample_posterior_predictive(trace, extend_inferencedata=True)

    # Forecast (Posterior prediction)
    # This is extending the trend into the future using the learned drift of the data
    print("\n--- Generating Forecasting Scenarios... ---")
    
    n_draws = 1000
    forecast_matrix = np.zeros((n_draws, forecast_days))

    # Extract Traces (Flatten chains and draws)
    # We use YOUR variable names here to keep it consistent
    
    # Reshape to (Total_Samples, Time_Steps)
    trends = trace.posterior['trend'].values.reshape(-1, len(demand_values))
    week_effs = trace.posterior['weekly_seasonality'].values.reshape(-1, 7)
    month_effs = trace.posterior['monthly_seasonality'].values.reshape(-1, 12)
    sigmas = trace.posterior['sigma'].values.flatten()
    
    # Randomly Sample and Construct Forecast
    draw_indices = np.random.choice(len(sigmas), n_draws)
    
    for i, idx in enumerate(draw_indices):
        # Trend: Project the LAST trend point forward (Naive Trend Forecast)
        base_trend = trends[idx, -1] 
        
        # Seasonality: Look up future days/months using YOUR pre-calculated indices
        future_week_eff = week_effs[idx, future_day_idxs]
        future_month_eff = month_effs[idx, future_month_idxs]
        
        # Noise
        noise = np.random.normal(0, sigmas[idx], size=forecast_days)
        
        # Combine & Rectify (Ensure no negative demand)
        forecast_matrix[i, :] = np.maximum(0, base_trend + future_week_eff + future_month_eff + noise)
            
    return forecast_matrix, trace

# Function for Cloud(LiNodes)
def run_bayesian_forecast_cloud(historical, forecast_days):
    """
    Create a Bayesian model to forecast demand based on the historical data and amount of forecast day
    this also getting the sales trend weekly and monthly

    historical: the historical demand data
    forecast_days: the amount of days to forecast
    """
    print(f"\n--- Running Bayesian Forecast for next {forecast_days} day ---")
    # Prep data for PyMC
    days_weeks = historical.index
    demand_values = historical.values.astype(np.float64)

    # The calibration -> Scale the prior based on the data
    data_mean = np.mean(demand_values)
    data_std = np.std(demand_values) + 1e-3 # buffer to avoid zero std

    # Extract the time features
    days_index = np.array(days_weeks.dayofweek, dtype=np.int32) # from 0-6 
    month_index = np.array(days_weeks.month - 1, dtype=np.int32) # from 0-11

    # Future times to represent the future dates
    last_date = days_weeks[-1]
    
    # Note: We don't need the full date range object, just the indices for the lookup
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=forecast_days, freq='D')
    future_day_idxs = np.array([d.dayofweek for d in future_dates])
    future_month_idxs = np.array([d.month - 1 for d in future_dates])

    with pm.Model() as forecast_model:
        # Trends Component, letting baseline shifts overtime based on the data
        # We init_dist at data_mean, so this ACTS as the baseline
        sigma_trend = pm.HalfNormal('sigma_trend', sigma=data_std * 0.1)
        trend = pm.GaussianRandomWalk('trend', sigma=sigma_trend, shape=len(demand_values),
                                      init_dist=pm.Normal.dist(data_mean, data_std))

        # Weekly Seasonality Component
        weekly_seasonality = pm.Normal('weekly_seasonality', mu=0, sigma=data_std, shape=7)

        # Monthly Seasonality Component
        monthly_seasonality = pm.Normal('monthly_seasonality', mu=0, sigma=data_std, shape=12)

        # Expected Demand
        # Math Formula => Demand = Trend + Weekly Seasonality + Monthly Seasonality 
        # (Removed 'baseline' variable as it was undefined and redundant with 'trend')
        expected_demand = trend + weekly_seasonality[days_index] + monthly_seasonality[month_index]

        # Observed Noise Component
        sigma = pm.HalfNormal('sigma', sigma=data_std)

        # Likelihood (How likely is the data given the model from the observations)
        # Math Formula => Demand = Expected Demand + Noise
        demand_data = pm.TruncatedNormal('demand_data', mu=expected_demand, sigma=sigma, lower=0.0, observed=demand_values)

        # Inference/Posterior (What is the most likely model given the data)
        print("\n--- Sampling the Posterior... ---")
        trace = pm.sample(500, tune=500, cores=1, chains=1, target_accept=0.95, progressbar=True)

        # Posterior Predictive
        pm.sample_posterior_predictive(trace, extend_inferencedata=True)

    # Forecast (Posterior prediction)
    # This is extending the trend into the future using the learned drift of the data
    print("\n--- Generating Forecasting Scenarios... ---")
    
    n_draws = 1000
    forecast_matrix = np.zeros((n_draws, forecast_days))

    # Extract Traces (Flatten chains and draws)
    # We use YOUR variable names here to keep it consistent
    
    # Reshape to (Total_Samples, Time_Steps)
    trends = trace.posterior['trend'].values.reshape(-1, len(demand_values))
    week_effs = trace.posterior['weekly_seasonality'].values.reshape(-1, 7)
    month_effs = trace.posterior['monthly_seasonality'].values.reshape(-1, 12)
    sigmas = trace.posterior['sigma'].values.flatten()
    
    # Randomly Sample and Construct Forecast
    draw_indices = np.random.choice(len(sigmas), n_draws)
    
    for i, idx in enumerate(draw_indices):
        # Trend: Project the LAST trend point forward (Naive Trend Forecast)
        base_trend = trends[idx, -1] 
        
        # Seasonality: Look up future days/months using YOUR pre-calculated indices
        future_week_eff = week_effs[idx, future_day_idxs]
        future_month_eff = month_effs[idx, future_month_idxs]
        
        # Noise
        noise = np.random.normal(0, sigmas[idx], size=forecast_days)
        
        # Combine & Rectify (Ensure no negative demand)
        forecast_matrix[i, :] = np.maximum(0, base_trend + future_week_eff + future_month_eff + noise)
            
    return forecast_matrix, trace

def optimal_quantity_financial(forecast_matrix, buy_price, sell_price, strategy='Balanced'):
    '''
    These functions will calculate the optimal order quantity using more vectorized Newsvendor Logic.
    This will be based on 3 strategy input: Balanced, Aggressive, and Conservative

    forecast_matrix: the posterior predictive samples from PyMC
    buy_price: the price of the ingredient to buy
    sell_price: the revenue from selling 1 unit (Menu Price Portion)
    strategy: the strategy to use (Balanced, Aggressive, Conservative)
    '''

    print(f"\n--- Optimizing for Profit (Buy: {buy_price} THB, Sell: {sell_price} THB) ---")

    # Calculate Costs based on Prices as follows: 
    # Cost of Overage = If we bought it, and didn't sell, Lost the buy_price of it. (Purchase Price)
    # Cost of Underage = If we didn't buy it, and sold it, Lost the sell_price of it. (Lost Margin)
    
    Co = buy_price
    Cu = sell_price - buy_price

    # 2. Apply Strategy Bias (The "Lie" to the math)
    if strategy == 'aggressive':
        # "Never run out." -> We tell the math that missing a sale is 2x more painful.
        Cu = Cu * 1.5
        print(">> ADJUSTMENT: Prioritizing Availability (Risking Waste)")
        
    elif strategy == 'conservative':
        # "Never waste food." -> We tell the math that wasting food is 2x more painful.
        Co = Co * 1.5
        print(">> ADJUSTMENT: Prioritizing Cash Flow (Risking Stockouts)")
    
    else:
        print(">> ADJUSTMENT: Standard Economic Optimization")
    
    # Vectorized Newsvendor Logic, based on the strategy
    total_demand = forecast_matrix.sum(axis=1) # based on sum across the days

    # Then we defince the search space for Q, the minimum demand and maximum demand
    # we find the min and max of the total demand, however if its equal, then make sure to based on the min
    min_q, max_q = int(total_demand.min()), int(total_demand.max())
    if min_q >= max_q:
        return min_q


    # Define the search space for Q
    possible_quantities = np.arange(min_q, max_q + 1)

    # Next, we vectorized the calculation using Grid method
    # demands: Column Vector (N,1)
    # orders: Row Vector (1,M)
    # result: Matric (N,M)
    
    demands = total_demand[:, np.newaxis]
    orders = possible_quantities[np.newaxis, :]

    # Then, we boardcast it to allow to compute all scenario all at the same time
    overage = np.maximum(0, orders - demands)
    underage = np.maximum(0, demands - orders)
    
    # Use the BIASED costs to find the "Strategic Best"
    
    expected_strategic_loss = (overage * Co) + (underage * Cu)
    best_index = np.argmin(expected_strategic_loss.mean(axis=0))
    optimal_q = possible_quantities[best_index]

    # Finally Caluclate the actual risk (Display Only)
    # Run the math to get the real cost base on their selected strategy
    real_Co = buy_price
    real_Cu = sell_price
    expected_real_loss = ((overage * real_Co) + (underage * real_Cu)).mean(axis=0)
    min_loss_baht = expected_real_loss[best_index]

    print(f"--- Optimization Done: Recommending {optimal_q} units ---")
    print(f"--- Estimated Financial Risk: {min_loss_baht:.2f} THB ---")

    return optimal_q

# Plot function with explanations "ONLY FOR DEBUGGING"
def plot_forecast_results_explained(historical_demand, forecast_dist, optimal_order, ingredient_name, reorder_period, unit, db_stock, lead_time):
    print("\n--- Generating HCD Dashboard (Primary & Historical) ---")

    last_date = historical_demand.index.max()
    forecast_dates = pd.to_datetime([last_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)])

    # Future Math
    high_bound, mean_vals = [], []
    for day_vals in np.moveaxis(forecast_dist, -1, 0):
        flat_data = day_vals.flatten()
        high_bound.append(np.percentile(flat_data, 95))
        mean_vals.append(np.mean(flat_data))

    projected_inventory = []
    current_inv = float(db_stock)
    for demand in mean_vals:
        current_inv -= demand
        projected_inventory.append(current_inv)

    # Historical Math (Last 30 days waste/shortage)
    recent_history = historical_demand.iloc[-30:]
    hist_stock = float(db_stock)
    waste_shortage = []
    for u in recent_history.values[::-1]:
        waste_shortage.append(hist_stock - u)
        hist_stock += u
    waste_shortage.reverse()

    # Create Side-by-Side Dashboard
    fig, (ax_hist, ax_fut) = plt.subplots(1, 2, figsize=(16, 6), gridspec_kw={'width_ratios': [1, 1.5]})
    fig.suptitle(f'Inventory Dashboard: {ingredient_name.title()}', fontsize=18, fontweight='bold')
    
    # HISTORICAL PLOT
    # Calculate the historical stock levels to plot as a subtle step line
    past_stock_levels = []
    current_calc_stock = float(db_stock)
    for u in recent_history.values[::-1]:
        past_stock_levels.append(current_calc_stock)
        current_calc_stock += u
    past_stock_levels.reverse()

    # Convert to numpy arrays for the shading math
    stock_arr = np.array(past_stock_levels)
    usage_arr = recent_history.values

    # Plot Stock as a soft blue step-line, and Usage as a solid dark line
    ax_hist.step(recent_history.index, past_stock_levels, where='mid', color='#a0c4df', linewidth=2, label='Historical Stock')
    ax_hist.plot(recent_history.index, recent_history.values, color='#444444', linewidth=2, label='Actual Usage')
    
    # Safe Buffer (Faint Blue Area)
    ax_hist.fill_between(recent_history.index, usage_arr, stock_arr, step='mid',
                         where=(stock_arr >= usage_arr),
                         color='#a0c4df', alpha=0.15, label='Safe Excess')
    
    # Dangerous Deficit (Vivid Red Area for understock)
    ax_hist.fill_between(recent_history.index, usage_arr, stock_arr, step='mid',
                         where=(stock_arr < usage_arr),
                         color='#ff0000', alpha=0.4, label='Stock Deficit')

    ax_hist.set_title('Past 30 Days: Stock vs. Usage', fontsize=12)
    ax_hist.set_ylabel(f'Quantity ({unit})')
    ax_hist.tick_params(axis='x', rotation=45)
    ax_hist.legend(loc='upper right')
    
    # PRIMARY PLOT: Future 7 Days
    # Convert lists to numpy arrays for the shading math
    proj_stock_arr = np.array(projected_inventory)
    high_bound_arr = np.array(high_bound)

    # The Lines: Solid for physical stock, Dashed for theoretical demand
    ax_fut.step(forecast_dates, proj_stock_arr, where='mid', color='#1f77b4', linewidth=3, label='Projected Stock')
    ax_fut.plot(forecast_dates, high_bound_arr, color='#ff8c00', linestyle='--', linewidth=2, label='95% Demand Upper Limit')
    
    # The Gap Shading (Mirroring the Past 30 Days)
    # Projected Safe Buffer (Faint Blue)
    ax_fut.fill_between(forecast_dates, high_bound_arr, proj_stock_arr, step='mid',
                         where=(proj_stock_arr >= high_bound_arr),
                         color='#a0c4df', alpha=0.15, label='Projected Safe Buffer')

    # Predicted Stockout (Vivid Red)
    ax_fut.fill_between(forecast_dates, high_bound_arr, proj_stock_arr, step='mid',
                         where=(proj_stock_arr < high_bound_arr),
                         color='#ff0000', alpha=0.4, label='Predicted Deficit')
    
    # Vivid Red Intersection Highlight (The "Crisis Point")
    for i in range(len(proj_stock_arr)):
        if proj_stock_arr[i] <= high_bound_arr[i]:
            ax_fut.plot(forecast_dates[i], proj_stock_arr[i], marker='o', color='#ff0000', markersize=10, zorder=5)
            ax_fut.text(forecast_dates[i], proj_stock_arr[i] + (db_stock*0.05), ' CRITICAL RISK', color='#ff0000', fontweight='bold')
            break

    ax_fut.axhline(0, color='black', linewidth=1)
    ax_fut.set_title('Next 7 Days: Supply Decay vs Likely Demand', fontsize=12)
    ax_fut.tick_params(axis='x', rotation=45)
    ax_fut.legend(loc='upper right')

    plt.tight_layout()
    plt.show()

# Chart for JSON output and send to frontend
def chart_data_json(historical_demand, forecast_dist, reorder_period, db_stock):
    '''
    This function generates the structured JSON output for the frontend's HCD dashboard.
    It splits the data into two distinct visual spaces to avoid implying false continuity:
    1. A 30-day historical performance view (for the diverging bar chart).
    2. A future forecast view (for the step-line and shaded demand area).

    Expected JSON Return Structure for Backend Parsing:
    {
        "historical_performance": [
            {
                "date": "2026-02-15", 
                "actual_usage": 700.0,
                "current_stock_at_time": 1200.0,
                "waste_shortage_qty": 500.0   <-- NOTE: Positive = Overstock buffer, Negative = Stockout
            },
            ...
        ],
        "future_view": [
            {
                "date": "2026-03-17",
                "mean_demand": 800.5,
                "likely_low_bound_5th": 650.0,
                "likely_high_bound_95th": 950.0
            },
            ...
        ]
    }

    args: 
    - historical_demand: the historical demand data (Pandas Series)
    - forecast_dist: the posterior predictive samples from PyMC
    - reorder_period: the reorder period (int, usually 7 days)
    - db_stock: current physical stock from the database (float)
    '''
    last_date = historical_demand.index.max()
    forecast_dates = pd.to_datetime([last_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)])
    
    # FUTURE VIEW (e.g., Next 7 Days)
    value_days = np.moveaxis(forecast_dist, -1, 0)
    future_list = []
    for i, day_vals in enumerate(value_days):
        flat_data = day_vals.flatten()
        future_list.append({
            "date": forecast_dates[i].strftime('%Y-%m-%d'),
            "mean_demand": float(np.mean(flat_data)),
            "likely_low_bound_5th": float(np.percentile(flat_data, 5)),
            "likely_high_bound_95th": float(np.percentile(flat_data, 95))
        })

    # 2. HISTORICAL PERFORMANCE (30 Days with Waste/Shortage calculation)
    recent_history = historical_demand.iloc[-30:]
    rev_demand = recent_history.values[::-1]
    dates_rev = recent_history.index[::-1]
    
    hist_stock = float(db_stock)
    historical_list = []
    
    for i in range(len(rev_demand)):
        u = float(rev_demand[i])
        waste_shortage = hist_stock - u
        historical_list.append({
            "date": dates_rev[i].strftime('%Y-%m-%d'),
            "actual_usage": u,
            "current_stock_at_time": round(hist_stock, 2),
            "waste_shortage_qty": round(waste_shortage, 2)
        })
        hist_stock += u # Add usage back to simulate previous day's stock
        
    historical_list.reverse() # Flip back into chronological order
        
    return {
        #"historical_performance": historical_list,
        "future_view": future_list
    } # Return the JSON object

# --- 3. MAIN WORKFLOW (API WORKER MODE) ---

if __name__ == "__main__":
    # 1. Setup Command Line Arguments
    parser = argparse.ArgumentParser(description="Munchbox Bayesian Forecaster")
    parser.add_argument("--ingredient", type=str, required=True, help="Ingredient to forecast")
    parser.add_argument("--strategy", type=str, default="2", help="1: Conservative, 2: Balanced, 3: Aggressive")
    parser.add_argument("--buy_price", type=float, default=None, help="Override DB Cost")
    parser.add_argument("--sell_price", type=float, required=True, help="Revenue per unit")
    parser.add_argument("--days", type=int, default=5, help="Days to forecast")
    
    args = parser.parse_args()
    
    ingredient_to_forecast = args.ingredient
    strat_choice = args.strategy
    sell_price = args.sell_price
    reorder_period = args.days

    print(f"[SYSTEM] Starting Job for {ingredient_to_forecast}...", file=sys.stderr)
    
    # 2. Fetch data
    daily_demand, unit, db_cost, db_stock, lead_time = get_data_from_sql(ingredient_to_forecast)
    
    if daily_demand is not None and not daily_demand.empty:
        # Strategy Setup
        strategy_map = {'1': 'conservative', '2': 'balanced', '3': 'aggressive'}
        selected_strat = strategy_map.get(strat_choice, 'balanced')

        # Use passed buy_price, fallback to DB cost, fallback to 100
        buy_price = args.buy_price if args.buy_price else (db_cost if db_cost > 0 else 100.0)

        # 3. Run Forecast
        if DEVICE == 'CLOUD':
            forecast_dist, trace = run_bayesian_forecast_cloud(daily_demand, reorder_period)
        else:
            forecast_dist, trace = run_bayesian_forecast(daily_demand, reorder_period)
        
        # 4. Optimize Quantity
        optimal_order = optimal_quantity_financial(forecast_dist, buy_price, sell_price, strategy=selected_strat)
        
        # 5. Calculate Final Order
        final_order = max(0, optimal_order - db_stock)
        
        # 6. Extract Math for JSON
        lead_time_days = lead_time
        safety_buffer = 1.1 # Buffer 10% more than projected

        total_demand_dist = forecast_dist.sum(axis=-1)
        mean_total_demand = float(np.mean(total_demand_dist))
        mean_daily_demand = mean_total_demand / reorder_period
        
        # Calculate Days of Coverage & Risk
        days_of_coverage = float(db_stock) / mean_daily_demand if mean_daily_demand > 0 else 999.0
        risk_priority = "High" if days_of_coverage < lead_time_days else "Normal"
        
        # Apply Safety Buffer to Final Order
        optimal_order_buffered = int(optimal_order * safety_buffer)
        final_order = max(0, optimal_order_buffered - db_stock)
        
        # Financial Risk Calc (Re-calculated for JSON output)
        overage = np.maximum(0, optimal_order - total_demand_dist)
        underage = np.maximum(0, total_demand_dist - optimal_order)
        financial_risk = float(np.mean((overage * buy_price) + (underage * sell_price)))

        chart_data = chart_data_json(daily_demand, forecast_dist, reorder_period, db_stock)

        # Calculate averages for the new DB columns
        all_highs = [d['likely_high_bound_95th'] for d in chart_data['future_view']]
        all_lows = [d['likely_low_bound_5th'] for d in chart_data['future_view']]

        # The Inventory Decay & Stockout Logic
        # This is to calculate the projected inventory and the stockout day for more information
        mean_daily_forecast = forecast_dist.mean(axis=0) # Average usage per day
        projected_inventory = []
        current_inv = float(db_stock)
        stockout_day_idx = -1
        
        for d in range(reorder_period):
            current_inv -= mean_daily_forecast[d]
            projected_inventory.append(max(0, current_inv)) # Don't go below 0 for charting
            if current_inv <= 0 and stockout_day_idx == -1:
                stockout_day_idx = d

        # Status Classification Heuristic
        if stockout_day_idx != -1 and stockout_day_idx <= lead_time:
            inventory_status = "CRITICAL"
        elif optimal_order > db_stock:
            inventory_status = "REORDER"
        else:
            inventory_status = "STABLE"
            
        days_until_stockout = int(stockout_day_idx) if stockout_day_idx != -1 else 999
        last_date = daily_demand.index.max()
        stockout_date = (last_date + pd.Timedelta(days=stockout_day_idx+1)).strftime('%Y-%m-%d') if stockout_day_idx != -1 else "N/A"

        chart_data = chart_data_json(daily_demand, forecast_dist, reorder_period, db_stock)

        # 7. Build the Final JSON Payload
        final_payload = {
            "ingredient_name": ingredient_to_forecast,
            "risk_priority": risk_priority,
            "recommendation": {
                "optimal_target_qty": optimal_order_buffered,
                "current_stock": float(db_stock),
                "to_purchase_qty": final_order,
                "days_of_coverage": round(days_of_coverage, 1),
                "lead_time_days": lead_time_days,
                "expected_usage": int(mean_total_demand), 
                "strategy_used": selected_strat.title(),
                "unit": unit
            },
            "chart_data": chart_data
        }

        # 8. OUTPUT EXACTLY ONE THING TO STDOUT: THE JSON
        plot_forecast_results_explained(daily_demand, forecast_dist, optimal_order, ingredient_to_forecast, reorder_period, unit, db_stock, lead_time_days)
        # The backend system will capture this string and parse it
        print(json.dumps(final_payload, indent=2))

        with open("forecast_output.json", "w") as f:
            json.dump(final_payload, f, indent=2)
        
    else:
        # Return an error JSON if no data was found
        error_payload = {"error": f"No demand data found for '{ingredient_to_forecast}'"}
        print(json.dumps(error_payload))