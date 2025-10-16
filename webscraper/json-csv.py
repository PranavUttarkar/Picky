import pandas as pd
import json

# Load JSON data from a file
json_name="events"
with open(f'{json_name}.json', 'r') as f:
    json_data = json.load(f)

# Convert JSON to a Pandas DataFrame
# For a list of dictionaries, pandas can directly create a DataFrame
df = pd.DataFrame(json_data)

# If the JSON is nested or complex, consider using json_normalize
# from pandas.io.json import json_normalize
# df = json_normalize(json_data)

# Write the DataFrame to a CSV file
df.to_csv(f'{json_name}.csv', index=False) # index=False prevents writing the DataFrame index as a column
