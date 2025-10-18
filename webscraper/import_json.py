import json
from supabase import create_client

# Initialize client
supabase = create_client("SUPABASE_URL", "SUPABASE_KEY")

# Load JSON file
with open("data.json", "r") as f:
    data = json.load(f)

# Insert into Supabase
response = supabase.table("your_table_name").insert(data).execute()

print(response)
