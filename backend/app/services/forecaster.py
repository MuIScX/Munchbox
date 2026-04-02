# app/services/forecaster.py
"""
Bridge module — imports run_forecast_job directly from the Bayesian model source.
Any changes made in BayesianTimeSeriesModel/src/ are automatically reflected here.
"""

import sys
import os

# Resolve the absolute path to the Bayesian model src folder
_BAYES_SRC = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "BayesianTimeSeriesModel", "src")
)

# Add to path if not already there
if _BAYES_SRC not in sys.path:
    sys.path.insert(0, _BAYES_SRC)

# Import the script as a module
# Note: the filename has dashes so we can't use normal import — use importlib instead
import importlib.util

_SCRIPT_NAME = "Bayes_Inventory_Imp_v3-2-5_sql"
_SCRIPT_FILE = os.path.join(_BAYES_SRC, f"{_SCRIPT_NAME}.py")

_spec   = importlib.util.spec_from_file_location(_SCRIPT_NAME, _SCRIPT_FILE)
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)

# Re-export what the route needs
run_forecast_job = _module.run_forecast_job