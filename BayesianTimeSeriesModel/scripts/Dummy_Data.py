from sqlite3.dbapi2 import Timestamp
import pandas as pd
import numpy as np

# Create Dummy BOM(Bill Of Material) Data
bom_data = {
    'menu_item': ['Pad Thai', 'Green Curry', 'Tom Yum', 'Fried Rice', 'Spring Rolls'],
    'Ingredient_1': ['Shrimp - 80g', 'Chicken - 100g', 'Shrimp - 60g', 'Rice - 150g', 'Cabbage - 40g'],
    'Ingredient_2': ['Noodle - 100g', 'Coconut Milk - 200ml', 'Mushroom - 50g', 'Egg - 1 unit', 'Carrot - 20g'],
    'Ingredient_3': ['Egg - 1 unit', 'Basil - 5g', 'Lemongrass - 10g', 'Pork - 50g', 'Wrapper - 1 unit']
}
df_bom = pd.DataFrame(bom_data)
df_bom.to_csv('data/dummy_bill_of_materials.csv', index=False)
print("Created data/dummy_bill_of_materials.csv")

# Create Dummy Sales Data
dates = pd.date_range(start=Timestamp.today(), periods=90)
sales_data = []

for date in dates:
    # Simulate sales for each menu item, and add multipliers for variability like weekends
    if date.dayofweek >=4: # Weekend
        sales_multiplier = 1.5
    else:
        sales_multiplier = 1.0

    for item in bom_data['menu_item']:
        # We create general sales data from range and multiply by sales_multiplier
        base_sales = np.random.randint(5, 20)
        qty = int(base_sales * sales_multiplier)
        sales_data.append({'date': date, 'ITEM': item, 'Sale Qty': qty})

df_sales = pd.DataFrame(sales_data)
df_sales.to_csv('data/dummy_sales_data.csv', index=False)
print("Created data/dummy_sales_data.csv")

# Create Dummy Inventory Data
inventory_data = {
    'ingredient': ['shrimp', 'chicken', 'rice', 'noodle', 'pork'],
    'quantity': [5000, 8000, 20000, 3000, 4000],
    'unit': ['g', 'g', 'g', 'g', 'g'],
    'last_update': [pd.Timestamp.today()] * 5
}
df_inv = pd.DataFrame(inventory_data)
df_inv.to_csv('data/dummy_inventory.csv', index=False)
print("Created data/dummy_inventory.csv")