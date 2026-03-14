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
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
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

def get_data_from_sql(ingredient_name_query, ingredient_id=None, restaurant_id=None):
    """
    Grabbing the daily usage directly from SQL now.
    ingredient_name_query: the name of the ingredient to search for
    ingredient_id: if provided, use this ID directly (avoids multi-restaurant ambiguity)
    restaurant_id: if provided, filter Sale_data by restaurant
    """
    print(f"\n[SQL] Searching for '{ingredient_name_query}'...")

    # A. First, find the Ingredient ID and details
    if ingredient_id is not None:
        q_ing = f"""
    SELECT id, name, unit, stock_left
    FROM ingredient
    WHERE id = {ingredient_id}
    LIMIT 1;
    """
    else:
        q_ing = f"""
    SELECT id, name, unit, stock_left
    FROM ingredient
    WHERE name LIKE '%%{ingredient_name_query}%%'
    LIMIT 1;
    """
    
    try:
        df_ing = pd.read_sql(q_ing, con=db_engine)
        
        if df_ing.empty:
            print(f"❌ Ingredient '{ingredient_name_query}' not found in database.")
            return None, None, 0, 0
            
        # Extract the stuff we need
        ing_id = df_ing.iloc[0]['id']
        ing_name = df_ing.iloc[0]['name']
        ing_unit = df_ing.iloc[0]['unit']
        ing_cost = 0.0  # cost_per_unit not stored in ingredient table; fallback to buy_price arg or 100
        ing_stock = float(df_ing.iloc[0]['stock_left'])
        
        print(f"   > Found: {ing_name} (ID: {ing_id})")
        print(f"   > Stock: {ing_stock} {ing_unit} | Cost: {ing_cost} THB")

        # B. Calculate Daily Usage (The Heavy Lifting)
        # Joining Sales -> Recipe -> Ingredient to see how much we actually used per day
        restaurant_filter = f"AND S.restaurant_id = {restaurant_id}" if restaurant_id is not None else ""
        q_usage = f"""
        SELECT
            DATE(S.timestamp) as date,
            SUM(S.amount * R.amount) as daily_usage
        FROM sale_data S
        JOIN recipe R ON S.menu_id = R.menu_id
        WHERE R.ingredient_id = {ing_id}
        {restaurant_filter}
        GROUP BY DATE(S.timestamp)
        ORDER BY date ASC;
        """
        
        print("   > Calculating historical usage from Sales & Recipes...")
        df_usage = pd.read_sql(q_usage, con=db_engine)
        
        if df_usage.empty:
            print("   ⚠️ No sales history found for this ingredient.")
            return None, ing_unit, ing_cost, ing_stock

        # C. Format it for the model
        df_usage['date'] = pd.to_datetime(df_usage['date'])
        daily_demand = df_usage.set_index('date')['daily_usage'].resample('D').sum().fillna(0)
        
        return daily_demand, ing_unit, ing_cost, ing_stock

    except Exception as e:
        print(f"❌ SQL Error: {e}")
        return None, None, 0, 0


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
    
    n_draws = 300
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
    Lightweight cloud Bayesian model: estimates mean/variance from history
    using only 2 latent variables (no GaussianRandomWalk) so MCMC runs fast
    on limited-CPU servers. Weekly seasonality kept via numpy groupby.
    """
    print(f"\n--- Running Lightweight Bayesian Forecast for next {forecast_days} days ---")

    demand_values = historical.values.astype(np.float64)
    days_weeks    = historical.index

    data_mean = float(np.mean(demand_values))
    data_std  = float(np.std(demand_values)) + 1e-3

    # Weekly effect via simple numpy mean per day-of-week (no MCMC needed)
    week_effect = np.zeros(7)
    for dow in range(7):
        mask = days_weeks.dayofweek == dow
        if mask.any():
            week_effect[dow] = float(np.mean(demand_values[mask])) - data_mean

    future_dates    = pd.date_range(
        start=days_weeks[-1] + pd.Timedelta(days=1), periods=forecast_days, freq='D'
    )
    future_dow_idxs = np.array([d.dayofweek for d in future_dates])

    # Simple Bayesian model: only mu + sigma as latent variables → very fast MCMC
    with pm.Model():
        mu    = pm.Normal('mu',    mu=data_mean, sigma=data_std)
        sigma = pm.HalfNormal('sigma', sigma=data_std)
        _     = pm.TruncatedNormal('obs', mu=mu, sigma=sigma, lower=0.0, observed=demand_values)

        print("\n--- Sampling the Posterior... ---")
        trace = pm.sample(200, tune=100, cores=1, chains=1,
                          target_accept=0.85, progressbar=False)

    # Build forecast matrix from posterior draws + weekly seasonality
    print("\n--- Generating Forecasting Scenarios... ---")
    n_draws = 300
    mu_samples    = trace.posterior['mu'].values.flatten()
    sigma_samples = trace.posterior['sigma'].values.flatten()
    draw_indices  = np.random.choice(len(mu_samples), n_draws)

    forecast_matrix = np.zeros((n_draws, forecast_days))
    for i, idx in enumerate(draw_indices):
        base      = mu_samples[idx] + week_effect[future_dow_idxs]
        noise     = np.random.normal(0, sigma_samples[idx], size=forecast_days)
        forecast_matrix[i, :] = np.maximum(0, base + noise)

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
def plot_forecast_results_explained(historical_demand, forecast_dist, optimal_order, ingredient_name, reorder_period, unit, buy_price):
    '''
    Plot more friendly version of the forecast for managers
    
    historical_demand: the historical demand data
    forecast_dist: the posterior predictive samples from PyMC
    optimal_order: the optimal order quantity
    ingredient_name: the name of the ingredient
    reorder_period: the reorder period
    unit: the unit of the ingredient
    '''
    print("\n--- Generating User-Friendly Plot ---")

    # Date Set Up
    last_date = historical_demand.index.max()
    forecast_dates = pd.to_datetime([last_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)])

    # Get and calculate ranges (90% Likely Range)
    '''
    Flatten chains/draws to get raw number
    The forecast distribution usually be chains,draws,days
    So we reshape to (chains*draws, days) and sum across days for statistics
    '''

    # 1.To 
    historical_thb = historical_demand 

    # First get raw values as flat array
    low_bound = []
    high_bound = []
    mean_vals = []

    value_by_day = np.moveaxis(forecast_dist, -1, 0)  # Move days to front, this is for iteration 

    for day_vals in value_by_day:
        flat_data = day_vals.flatten()
        # Get the low and high percentiles of the data we have and then multiply with the buy price to 
        # get the financial value in Thai Baht and append to the list
        low_bound.append(np.percentile(flat_data, 5))
        high_bound.append(np.percentile(flat_data, 95))
        mean_vals.append(np.mean(flat_data))

    daily_target_qty = (optimal_order / reorder_period) 

    plt.figure(figsize=(15, 7))
    
    # 1. Historical-usage (Blue in UI, Dark Gray here)
    plt.plot(historical_demand.index[-30:], historical_demand.values[-30:], 
             color='#333333', linewidth=2, label='Historical-usage (g)') # 

    # 2. Historical-forecasting (Commented out due to not used during actual implementation, remove when needed)
    # Note: Requires extracting 'model_fit' from posterior predictive
    # plt.plot(historical_demand.index[-30:], historical_model_fit[-30:], 
    #          color='#FF8C00', alpha=0.6, label='Historical-forecasting (g)')

    # 3. Future-Forecasting (Green dashed in UI, Orange dashed here)
    plt.plot(forecast_dates, mean_vals, '--o', 
             color='#FF8C00', markersize=8, label='Future-Forecasting (g)') # Future Forecasting
    
    # 4. Suggestion Range (Shaded area)
    plt.fill_between(forecast_dates, low_bound, high_bound, 
                     color='#FFA500', alpha=0.3, label='Suggestion Range (g)') # Suggested Range

    # 5. Daily-Target-Average (Red horizontal line)
    plt.plot([forecast_dates[0], forecast_dates[-1]], [daily_target_qty, daily_target_qty], 
             color='#FF0000', linestyle=':', linewidth=2,
             label=f'Daily-Target-Average (~{int(daily_target_qty):,} {unit}/day)') # Daily Target Average
    
    # --- Styling for Readability ---
    plt.title(f'Usage Forecast: {ingredient_name.title()}', fontsize=16, fontweight='bold') # Title
    plt.ylabel(f'Quantity ({unit})', fontsize=12) # Y Axis Label
    plt.xlabel('Date', fontsize=12) # X Axis Label
    plt.grid(True, linestyle='--', alpha=0.5) # Grid
    
    # Formatting Y-axis with commas for grams
    plt.gca().get_yaxis().set_major_formatter(plt.FuncFormatter(lambda x, loc: "{:,}".format(int(x)))) # Format Y-axis with commas

    # Update Text Box: "Recommendation" per Sally's request
    text_str = (f"Recommendation: Stock {int(optimal_order)} {unit}\n"
                f"Estimated Value: {int(optimal_order * buy_price):,} THB\n"
                f"Covering next {reorder_period} days") # [cite: 1, 2]
                
    plt.text(0.98, 0.95, text_str, transform=plt.gca().transAxes, fontsize=12,
             verticalalignment='top', horizontalalignment='right', 
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))

    plt.legend(loc='upper left', frameon=True, fontsize=11)
    plt.tight_layout()
    plt.show()

# Chart for JSON output and send to frontend
def chart_data_json(historical_demand, forecast_dist, reorder_period, trace):
    '''
    This function is used to generate the JSON output for the frontend.
    It takes the historical demand and the forecast distribution as input.
    This is expected return as JSON object with the following structure:
    {
        "historical": [
            {"date": "2025-05-01", "actual_sales": 0},
            {"date": "2025-05-02", "actual_sales": 700},
            {"date": "2025-05-03", "actual_sales": 800}
        ],
        "forecast": [
            {
                "date": "2025-05-31",
                "median_demand": 0,
                "likely_low_bound_5th": 0,
                "likely_high_bound_95th": 850
            },
            {
                "date": "2025-06-01",
                "median_demand": 0,
                "likely_low_bound_5th": 0,
                "likely_high_bound_95th": 2100
            }
        ]
    }

    args: 
    - historical_demand: the historical demand data
    - forecast_dist: the posterior predictive samples from PyMC
    - reorder_period: the reorder period
    '''

    last_date = historical_demand.index.max() # Get last date of historical demand

    # SAFELY PRINT TO TERMINAL FOR DEBUGGING:
    print(f"\n[DEBUG] The absolute last day of actual sales is: {last_date}", file=sys.stderr)

    forecast_dates = pd.to_datetime([last_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)]) # Generate forecast dates
    value_days = np.moveaxis(forecast_dist, -1, 0) # Move days to front, this is for iteration 

    # SAFELY PRINT TO TERMINAL FOR DEBUGGING:
    print(f"[DEBUG] The first forecast date is: {forecast_dates[0]}", file=sys.stderr)
    print(f"[DEBUG] The last forecast date is: {forecast_dates[-1]}", file=sys.stderr)

    forecast_list = []

    for i, day_vals in enumerate(value_days):
        flat_data = day_vals.flatten() # Flatten data
        # Get the low and high percentiles of the data we have
        low = float(np.percentile(flat_data, 5))
        high = float(np.percentile(flat_data, 95))
        mean_val = float(np.mean(flat_data))
        # Add to lists
        forecast_list.append({
            "date": forecast_dates[i].strftime('%Y-%m-%d'),
            "mean_demand": mean_val,
            "likely_low_bound_5th": low,
            "likely_high_bound_95th": high
        }) # Append to list with the forecast date, median demand, and the 5th and 95th percentile of the forecast distribution in shaded area

    historical_forecast_values = trace.posterior_predictive['demand_data'].mean(dim=['chain', 'draw']).values

    historical_list = [] # List to store historical data
    for i, (date, value) in enumerate(historical_demand.items()):
        historical_list.append({
            "date": date.strftime('%Y-%m-%d'),
            "actual_usage": float(value),
            "model_fit": float(historical_forecast_values[i]) # Orange line to show model fit
        })
        
    return {
            "historical": historical_list,
            "forecast": forecast_list
        } # Return the JSON object

# --- 3. MAIN WORKFLOW ---

# --- 3. MAIN WORKFLOW (API WORKER MODE) ---

if __name__ == "__main__":
    # 1. Setup Command Line Arguments
    parser = argparse.ArgumentParser(description="Munchbox Bayesian Forecaster")
    parser.add_argument("--ingredient", type=str, required=True, help="Ingredient to forecast")
    parser.add_argument("--ingredient_id", type=int, default=None, help="Ingredient ID (overrides name lookup)")
    parser.add_argument("--restaurant_id", type=int, default=None, help="Restaurant ID for data isolation")
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
    daily_demand, unit, db_cost, db_stock = get_data_from_sql(ingredient_to_forecast, ingredient_id=args.ingredient_id, restaurant_id=args.restaurant_id)
    
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
        total_demand_dist = forecast_dist.sum(axis=-1)
        mean_total_demand = float(np.mean(total_demand_dist))
        
        # Financial Risk Calc (Re-calculated for JSON output)
        overage = np.maximum(0, optimal_order - total_demand_dist)
        underage = np.maximum(0, total_demand_dist - optimal_order)
        financial_risk = float(np.mean((overage * buy_price) + (underage * sell_price)))

        chart_data = chart_data_json(daily_demand, forecast_dist, reorder_period, trace)

        # Calculate averages for the new DB columns
        all_highs = [d['likely_high_bound_95th'] for d in chart_data['forecast']]
        all_lows = [d['likely_low_bound_5th'] for d in chart_data['forecast']]

        # 7. Build the Final JSON Payload
        final_payload = {
            "ingredient_name": ingredient_to_forecast,
            "recommendation": {
                "optimal_target_qty": int(optimal_order),
                "daily_target_avg": round(optimal_order / reorder_period, 2), 
                "reorder_period": int(reorder_period),
                "current_stock": float(db_stock),
                "to_purchase_qty": int(final_order),
                "expected_usage": int(mean_total_demand), 
                "upper_bound": round(np.mean(all_highs), 2), 
                "lower_bound": round(np.mean(all_lows), 2), 
                "strategy_used": selected_strat.title(),
                "financial_risk_thb": round(financial_risk, 2),
                "unit": unit
            },
            "chart_data": chart_data
        }

        # 8. OUTPUT EXACTLY ONE THING TO STDOUT: THE JSON
        plot_forecast_results_explained(daily_demand, forecast_dist, optimal_order, ingredient_to_forecast, reorder_period, unit, buy_price)
        # The backend system will capture this string and parse it
        print(json.dumps(final_payload, indent=2))

        with open("forecast_output.json", "w") as f:
            json.dump(final_payload, f, indent=2)
        
    else:
        # Return an error JSON if no data was found
        error_payload = {"error": f"No demand data found for '{ingredient_to_forecast}'"}
        print(json.dumps(error_payload))