#!/usr/bin/env python3
"""
Direct PostgreSQL COPY import (fastest method)
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Build PostgreSQL connection string (direct connection)
DB_HOST = 'db.thjwryuhtwlfxwduyqqd.supabase.co'
DB_PORT = '5432'  # Direct port
DB_NAME = 'postgres'
DB_USER = 'postgres'  # Standard postgres user
DB_PASSWORD = 'ciszer-joxgum-soPxa8'

CSV_FILE = 'data/bolagsverket_data.csv'

print("🚀 Direct PostgreSQL COPY import\n")
print(f"📂 CSV file: {CSV_FILE}")
print(f"🎯 Target: {DB_HOST}/{DB_NAME}\n")

try:
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode='require'
    )
    print("✓ Connected to PostgreSQL\n")

    cursor = conn.cursor()

    # Use COPY FROM for ultra-fast import
    print("📥 Importing data with COPY FROM...")

    with open(CSV_FILE, 'r') as f:
        # Skip header row
        next(f)

        cursor.copy_expert(
            """
            COPY public.companies (
                organisationsidentitet,
                namnskyddslopnummer,
                registreringsland,
                organisationsnamn,
                organisationsform,
                avregistreringsdatum,
                avregistreringsorsak,
                pagandeavvecklingselleromsstruktureringsforfarande,
                registreringsdatum,
                verksamhetsbeskrivning,
                postadress
            )
            FROM STDIN
            WITH (FORMAT CSV, NULL '\\N')
            """,
            f
        )

    conn.commit()

    # Verify import
    cursor.execute("SELECT COUNT(*) FROM public.companies")
    count = cursor.fetchone()[0]

    print(f"\n✅ IMPORT COMPLETE!")
    print(f"📊 Imported: {count:,} companies")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
