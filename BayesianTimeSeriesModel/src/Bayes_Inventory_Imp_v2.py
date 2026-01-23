### Necessary Library for Bayesian Inference
import pandas as pd
import numpy as np
import pymc as pm
import arviz as arvi
import matplotlib.pyplot as plt
import re # For string operations

# --- 1. FILE CONFIGURATION, All file listed here is dummy data for public demonstration ---
SALES_DATA_FILE = 'data/dummy_sales_data.csv'
BOM_FILE = 'data/dummy_bill_of_materials.csv'
INVENTORY_FILE = 'data/dummy_inventory.csv'

# --- 2. CORE FUNCTIONS ---

def preprocess_sales_data(sales_file, bom_file, ingredient_to_forecast):
    """
    Calculates the daily demand for a *single raw ingredient*
    by parsing the "Item - Amount(Unit)" format from the BOM cells.
    """
    print("\n--- Starting Data Preprocessing with 'Item - Amount' logic ---")
    try:
        df_sales = pd.read_csv(sales_file)
        df_bom = pd.read_csv(bom_file)
    except FileNotFoundError as e:
        print(f"ERROR: Could not find a required file. {e}")
        return None, None

    # --- A. Clean and Prepare Data ---
    df_sales.rename(columns={'ITEM': 'menu_item', 'Sale Qty': 'quantity_sold'}, inplace=True)
    df_sales['menu_item'] = df_sales['menu_item'].astype(str).str.lower().str.strip()
    
    try:
        df_bom.rename(columns={'Menu_Item': 'menu_item'}, inplace=True)
    except KeyError:
        if 'menu_item' not in df_bom.columns:
            print("ERROR: Your BOM file must have a 'menu_item' or 'Menu_Item' column.")
            return None, None
            
    df_bom['menu_item'] = df_bom['menu_item'].astype(str).str.lower().str.strip()
    ingredient_to_forecast = str(ingredient_to_forecast).lower().strip()

    # --- B. Merge Sales and BOM ---
    print("Merging sales data with Bill of Materials...")
    df_merged = pd.merge(df_sales, df_bom, on='menu_item', how='left')
    
    if df_merged.empty:
        print("ERROR: Merge resulted in an empty DataFrame. Check 'menu_item' matching.")
        return None, None

    # --- C. Calculate Demand using "Ingredient - Qty" string format ---
    print(f"Calculating total daily demand for '{ingredient_to_forecast}'...")

    # Find all 'Ingredient_N' columns
    ingredient_cols = [col for col in df_bom.columns if col.startswith('Ingredient_')]
    if not ingredient_cols:
        print("ERROR: No 'Ingredient_N' columns found in BOM. Check BOM format.")
        return None, None

    df_merged['total_ingredient_qty_per_sale'] = 0.0
    found_unit = 'unit' # Default unit

    # Loop through each ingredient column (Ingredient_1, Ingredient_2, etc.)
    for col in ingredient_cols:
        
        # This function is applied to every row *for this column*
        def parse_bom_cell(cell_value):
            # 1. Check if cell is valid
            if pd.isna(cell_value):
                return 0.0
            
            cell_str = str(cell_value).lower().strip()
            
            try:
                # 2. Parse the "item - amount(unit)" format
                parts = cell_str.split('-')
                if len(parts) < 2:
                    return 0.0 # Not the right format
                
                ingredient_name = parts[0].strip()
                amount_str = parts[1].strip()
                
                # 3. Check if this is the ingredient we are looking for
                if ingredient_to_forecast in ingredient_name:
                    
                    # 4. Extract the numeric quantity
                    # This will find '100' in '100g' or '100 (g)'
                    quantity_match = re.search(r"[\d\.]+", amount_str)
                    
                    if quantity_match:
                        # 5. Try to extract the unit
                        nonlocal found_unit
                        unit_match = re.search(r"\((.*?)\)", amount_str) # Finds text in ( )
                        if unit_match and found_unit == 'unit':
                            found_unit = unit_match.group(1)
                        elif found_unit == 'unit': # Fallback for '100g'
                            unit_str = re.sub(r"[\d\.]+", '', amount_str).strip()
                            if unit_str: found_unit = unit_str
                            
                        return float(quantity_match.group(0))
            except Exception:
                return 0.0
            
            return 0.0
        
        # Apply the parsing function to the column and add to the total
        df_merged['total_ingredient_qty_per_sale'] += df_merged[col].apply(parse_bom_cell)

    # --- D. Final Calculation ---
    df_merged['daily_ingredient_demand'] = df_merged['quantity_sold'] * df_merged['total_ingredient_qty_per_sale']
    
    if df_merged['daily_ingredient_demand'].sum() == 0:
        print(f"WARNING: No demand found for '{ingredient_to_forecast}'.")
        print("Check that this ingredient exists in the BOM in 'item - amount' format.")
        # We'll let it continue, which will show the flat-line graph

    # --- E. Aggregate Daily Demand ---
    df_merged['date'] = pd.to_datetime(df_merged['date'])
    daily_demand_series = df_merged.groupby('date')['daily_ingredient_demand'].sum()
    daily_demand = daily_demand_series.resample('D').sum().fillna(0)
    
    print("--- Data Preprocessing Completed ---")
    return daily_demand, found_unit


def run_bayesian_forecast(historical, forecast_days):
    """(This function is UNCHANGED)"""
    print(f"\n--- Running Bayesian Forecast for next {forecast_days} days ---")
    days_weeks = historical.index.dayofweek.to_numpy()
    demand_values = historical.values
    with pm.Model() as forecast_model:
        baseline = pm.Normal('baseline', mu=demand_values.mean(), sigma=1000)
        dow_effect = pm.Normal('day_of_week_effect', mu=0, sigma=500, shape=7)
        sigma = pm.HalfNormal('sigma', sigma=1000)
        weekday_data = pm.Data('weekday_data', days_weeks)
        demand_data = pm.Data('demand_data', demand_values)
        expected_demand = baseline + dow_effect[weekday_data]
        observed_data = pm.TruncatedNormal('observed', mu=expected_demand, sigma=sigma, lower=0.0, observed=demand_data)
        trace = pm.sample(2000, tune=1000, cores=1, progressbar=True)
        last_day_week = historical.index[-1].dayofweek
        dow_forecast = (last_day_week + 1 + np.arange(forecast_days)) % 7
        pm.set_data({"weekday_data" : dow_forecast, "demand_data": np.zeros(forecast_days)})
        forecast_sample = pm.sample_posterior_predictive(trace, var_names=['observed'], predictions=True)
    print("--- Forecast Demand Completed ---")
    return forecast_sample.predictions['observed']


def optimal_quantity(forecast_distribution, cost_over, cost_under):
    """(This function is UNCHANGED)"""
    print("\n--- Finding Optimal Order Quantity ---")
    num_observations = forecast_distribution.shape[-1]
    reshaped_values = forecast_distribution.values.reshape(-1, num_observations)
    demand_period = reshaped_values.sum(axis=1)
    min_q, max_q = int(demand_period.min()), int(demand_period.max())
    if min_q >= max_q: return min_q
    possible_quantities = np.arange(min_q, max_q)
    expected_loss = []
    for Q in possible_quantities:
        overage = np.maximum(0, Q - demand_period); underage = np.maximum(0, demand_period - Q)
        loss = (overage * cost_over) + (underage * cost_under); expected_loss.append(loss.mean())
    if not expected_loss: return min_q
    optimal_q = possible_quantities[np.argmin(expected_loss)]
    print("--- Optimization Done ---")
    return optimal_q

# Deprecated: Original plot function
def plot_forecast_results(historical_demand, forecast_dist, optimal_order, ingredient_name, reorder_period, unit):
    """(This function is UPDATED to show the unit)"""
    print("\n--- Generating Plot ---")
    last_date = historical_demand.index.max()
    forecast_dates = pd.to_datetime([last_date + pd.DateOffset(days=i) for i in range(1, reorder_period + 1)])
    plt.figure(figsize=(15, 7)); plt.plot(historical_demand.index[-30:], historical_demand.values[-30:], 'k-', label='Historical Daily Demand')
    arvi.plot_hdi(x=forecast_dates, y=forecast_dist, hdi_prob=0.94, color='C1', fill_kwargs={'alpha': 0.3, 'label': '94% Forecast Interval'}, smooth=False)
    median_forecast_vals = forecast_dist.median(dim=("chain", "draw")).values
    plt.plot(forecast_dates, median_forecast_vals, 'o', color='C1', markersize=10, label='Median Daily Forecast')
    plt.axhline(y=optimal_order, color='r', linestyle='--', label=f'Optimal Order for Period ({optimal_order})')
    plt.title(f'"{ingredient_name}" Demand: Historical vs. Forecast')
    plt.xlabel('Date'); plt.ylabel(f'Demand ({unit})'); plt.legend(); plt.grid(True); plt.tight_layout(); plt.show()

# Improved plot function with explanations
def plot_forecast_results_explained(historical_demand, forecast_dist, optimal_order, ingredient_name, reorder_period, unit):
    '''Plot more friendly version of the forecast for managers'''
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

    # First get raw values as flat array
    low_bound = []
    high_bound = []
    median_vals = []

    value_by_day = np.moveaxis(forecast_dist.values, -1, 0)  # Move days to front, this is for iteration 

    for day_vals in value_by_day:
        flat_data = day_vals.flatten()
        # Get the low and high percentiles of the data we have
        low = np.percentile(flat_data, 5)
        high = np.percentile(flat_data, 95)
        median = np.median(flat_data)
        # Add to lists
        low_bound.append(low)
        high_bound.append(high)
        median_vals.append(median)

    plt.figure(figsize=(15, 7))
    plt.plot(historical_demand.index[-30:], historical_demand.values[-30:], 
             color='#333333', linewidth=2, label='Actual Past Sales') # Focus on last 30 days
    plt.fill_between(forecast_dates, low_bound, high_bound, 
                     color='#FFA500', alpha=0.3, label='90% Likely Demand Range') # Likely range shaded area
    
    plt.plot(forecast_dates, median_vals, 'o', 
             color='#FF8C00', markersize=8, label='Median Daily Forecast') # Most Likely line
    
    plt.axhline(y=optimal_order, color='#FF0000', linestyle='--',
                label=f'Optimal Order Quantity ({optimal_order} {unit})') # Optimal order line
    
    # 4. Styling for Readability
    plt.title(f'Inventory Forecast: {ingredient_name.title()}', fontsize=16, fontweight='bold')
    plt.ylabel(f'Quantity ({unit})', fontsize=12)
    plt.xlabel('Date', fontsize=12)
    plt.grid(True, which='both', linestyle='--', alpha=0.5)
    
    # Add a text box explaining the recommendation
    text_str = f"Plan: Stock {int(optimal_order)} {unit}\nCovering next {reorder_period} days"
    plt.text(0.98, 0.95, text_str, transform=plt.gca().transAxes, fontsize=12,
             verticalalignment='top', horizontalalignment='right', 
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))

    plt.legend(loc='upper left', frameon=True, fontsize=11)
    plt.tight_layout()
    plt.show()

def get_current_stock(ingredient_name, inventory_file):
    """(This function is UPDATED to read the new inventory file)"""
    try:
        df_inv = pd.read_csv(inventory_file)
        ingredient_name_clean = str(ingredient_name).lower().strip()
        df_inv['ingredient'] = df_inv['ingredient'].astype(str).str.lower().str.strip()
        stock_row = df_inv[df_inv['ingredient'] == ingredient_name_clean]
        if stock_row.empty:
            print(f"WARNING: Ingredient '{ingredient_name}' not found in {inventory_file}. Assuming 0 stock.")
            return 0, 'unknown unit'
        
        current_stock = int(stock_row['quantity'].values[0])
        unit = stock_row['unit'].values[0]
        return current_stock, unit
        
    except FileNotFoundError:
        print(f"WARNING: Inventory file '{inventory_file}' not found. Assuming 0 stock.")
        return 0, 'unknown unit'

def update_inventory_file(ingredient_name, inventory_file, forecasted_demand_amount):
    """
    Deducts the forecasted demand from the inventory CSV file.
    WARNING: This modifies the file directly.
    """
    print(f"\n--- Updating Inventory File for '{ingredient_name}' ---")
    try:
        df_inv = pd.read_csv(inventory_file)
        
        # Clean names for a reliable match
        ingredient_name_clean = str(ingredient_name).lower().strip()
        df_inv['ingredient'] = df_inv['ingredient'].astype(str).str.lower().str.strip()

        # Find the row for our ingredient
        row_index = df_inv[df_inv['ingredient'] == ingredient_name_clean].index
        
        if not row_index.empty:
            # Get the first matching row index
            idx = row_index[0]
            
            # 1. Get current stock
            current_stock = df_inv.at[idx, 'quantity']
            
            # 2. Calculate new stock (and make sure it can't be negative)
            new_stock = max(0, current_stock - int(forecasted_demand_amount))
            
            # 3. Update the DataFrame
            df_inv.at[idx, 'quantity'] = new_stock
            df_inv.at[idx, 'last_update'] = pd.to_datetime('today').isoformat()
            
            # 4. Save the changes back to the CSV
            df_inv.to_csv(inventory_file, index=False)
            print(f"Successfully updated stock for '{ingredient_name}'.")
            print(f"Old Stock: {current_stock} -> New Stock: {new_stock}")
        else:
            print(f"Could not find '{ingredient_name}' in {inventory_file} to update.")
            
    except Exception as e:
        print(f"ERROR while updating inventory file: {e}")

# --- 3. MAIN WORKFLOWx ---

if __name__ == "__main__":
    
    print("Welcome to the Raw Ingredient Demand Forecaster!")
    ingredient_to_forecast = input("Enter the raw ingredient to forecast (e.g., 'chicken'): ")
    
    try:
        cost_over = float(input("Enter the cost of Waste over unit: "))
        cost_under = float(input("Enter the cost of Lost Sales over unit: "))
        reorder_period = int(input("How many days to forecast?: "))
    except ValueError:
        print("Invalid number. Please enter a valid number for costs and days.")
    else:
        # 1. Preprocess Data
        daily_demand, unit = preprocess_sales_data(SALES_DATA_FILE, BOM_FILE, ingredient_to_forecast)
        
        if daily_demand is not None and not daily_demand.empty:
            # 2. Run Forecast
            forecast_dist = run_bayesian_forecast(daily_demand, reorder_period)
            
            # 3. Optimize Quantity
            optimal_order = optimal_quantity(forecast_dist, cost_over, cost_under)
            
            # 4. Get Current Stock
            current_stock, stock_unit = get_current_stock(ingredient_to_forecast, INVENTORY_FILE)
            
            # 5. Calculate Final Order
            final_order = max(0, optimal_order - current_stock)
            
            # 6. Display Results
            #median_forecast_raw = forecast_dist.values.reshape(-1, forecast_dist.shape[-1]).sum(axis=1)
            median_forecast = np.median(forecast_dist.values)

            if hasattr(forecast_dist, 'values'):
                total_demand_dist = forecast_dist.values.sum(axis=-1)
            else:
                total_demand_dist = forecast_dist.sum(axis=-1)
                
            median_total_demand = np.median(total_demand_dist)

            strat_message = "" 

            if optimal_order < median_forecast * 0.95:
                strat_message = " (Conservative Order: Below Median Demand)\n   Reason: Waste cost is high, so we are ordering slightly below average demand."
            elif optimal_order > median_forecast * 1.05:
                strat_message = " (Aggressive Order: Above Median Demand)\n  Reason: Lost sales cost is high, so we are ordering slightly above average demand."
            else:
                strat_message = " (Balanced Order: Near Median Demand)\n  Reason: Waste and lost sales costs are balanced."
            
            print("\n" + "="*40)
            print("    INVENTORY RECOMMENDATION SYSTEM")
            print("="*40)
            print(f"Ingredient: {ingredient_to_forecast} ({unit})")
            print(f"Forecast Period: Next {reorder_period} days")
            print("-" * 40)
            print(strat_message)
            print("-" * 40)
            print(f"Total Expected Usage:   ~{int(median_total_demand)} {unit}")
            print(f"Optimal Stock Target:   {int(optimal_order)} {unit}")
            print(f"Current Stock On Hand:  {current_stock} {stock_unit}")
            print("-" * 40)
            print(f"RECOMMENDED PURCHASE:   {final_order} {unit}")
            print("="*40 + "\n")

            # 7. Plot
            plot_forecast_results_explained(daily_demand, forecast_dist, optimal_order, ingredient_to_forecast, reorder_period, unit)
            # 8. Update Inventory File
            #update_inventory_file(ingredient_to_forecast, INVENTORY_FILE, median_forecast)
            
        else:
            print(f"No demand data found for '{ingredient_to_forecast}'. Check your BOM.")