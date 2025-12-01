#!/usr/bin/env python3
"""
Convert Parquet to CSV (NaN → NULL)
"""

import pyarrow.parquet as pq
import pandas as pd

print("📂 Reading Parquet file...")
table = pq.read_table('data/bolagsverket_data.parquet')
df = table.to_pandas()

# Clean column names
df.columns = df.columns.str.lower()
if '__index_level_0__' in df.columns:
    df = df.drop(columns=['__index_level_0__'])

# Clean organisationsnamn (remove $ suffix)
if 'organisationsnamn' in df.columns:
    df['organisationsnamn'] = df['organisationsnamn'].str.split('$').str[0]

print(f"✓ Loaded {len(df):,} rows")
print(f"📝 Columns: {', '.join(df.columns)}")

# Save to CSV (pandas automatically converts NaN to empty string)
output_file = 'data/bolagsverket_data.csv'
print(f"\n💾 Saving to {output_file}...")
df.to_csv(output_file, index=False, na_rep='\\N')  # PostgreSQL NULL format

print(f"✅ Done! Created {output_file}")
print(f"📊 {len(df):,} rows ready for import")
