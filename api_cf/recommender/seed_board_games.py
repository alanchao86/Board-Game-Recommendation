import os
from typing import Iterable, List, Tuple

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values


DB_HOST = os.getenv("DB_HOST", "postgres")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "recommend")

GAMES_PKL_PATH = os.getenv("GAMES_PKL_PATH", "/app/model_data/games.pkl")
BATCH_SIZE = int(os.getenv("SEED_BATCH_SIZE", "2000"))
SEED_FORCE = os.getenv("SEED_FORCE", "0").lower() in {"1", "true", "yes", "y"}


def _to_py_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    return value


def _chunked(rows: List[Tuple], size: int) -> Iterable[List[Tuple]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def get_board_games_count() -> int:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME,
    )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM board_games")
                return int(cur.fetchone()[0])
    finally:
        conn.close()


def load_games(path: str) -> List[Tuple]:
    df = pd.read_pickle(path)

    column_map = {
        "BGGId": "bggid",
        "Name": "name",
        "Description": "description",
        "YearPublished": "yearpublished",
        "AvgRating": "avgrating",
        "MinPlayers": "minplayers",
        "MaxPlayers": "maxplayers",
        "NumUserRatings": "numuserratings",
        "ImagePath": "imagepath",
    }

    missing = [c for c in column_map if c not in df.columns]
    if missing:
        raise ValueError(f"games.pkl missing required columns: {missing}")

    use_cols = list(column_map.keys())
    df = df[use_cols].rename(columns=column_map)

    # Basic sanitation for stable seed behavior.
    df = df.drop_duplicates(subset=["bggid"], keep="first")
    df = df.dropna(subset=["bggid", "name"])

    int_cols = ["bggid", "yearpublished", "minplayers", "maxplayers", "numuserratings"]
    for col in int_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

    df["avgrating"] = pd.to_numeric(df["avgrating"], errors="coerce")

    rows = []
    ordered_cols = [
        "bggid",
        "name",
        "description",
        "yearpublished",
        "avgrating",
        "minplayers",
        "maxplayers",
        "numuserratings",
        "imagepath",
    ]

    for row in df[ordered_cols].itertuples(index=False, name=None):
        rows.append(tuple(_to_py_value(v) for v in row))

    return rows


def upsert_board_games(rows: List[Tuple]) -> None:
    if not rows:
        print("No rows to seed.")
        return

    sql = """
        INSERT INTO board_games
          (bggid, name, description, yearpublished, avgrating, minplayers, maxplayers, numuserratings, imagepath)
        VALUES %s
        ON CONFLICT (bggid)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          yearpublished = EXCLUDED.yearpublished,
          avgrating = EXCLUDED.avgrating,
          minplayers = EXCLUDED.minplayers,
          maxplayers = EXCLUDED.maxplayers,
          numuserratings = EXCLUDED.numuserratings,
          imagepath = EXCLUDED.imagepath
    """

    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME,
    )
    try:
        with conn:
            with conn.cursor() as cur:
                for chunk in _chunked(rows, BATCH_SIZE):
                    execute_values(cur, sql, chunk, page_size=min(len(chunk), 1000))
                cur.execute("SELECT COUNT(*) FROM board_games")
                total = cur.fetchone()[0]
        print(f"Seed completed. Upserted rows: {len(rows)}; board_games total rows: {total}")
    finally:
        conn.close()


def main():
    existing_count = get_board_games_count()
    if existing_count > 0 and not SEED_FORCE:
        print(
            f"Skip seeding: board_games already has {existing_count} rows. "
            "Set SEED_FORCE=1 to force reseed."
        )
        return

    print(f"Loading games from: {GAMES_PKL_PATH}")
    rows = load_games(GAMES_PKL_PATH)
    print(f"Prepared rows: {len(rows)}")
    upsert_board_games(rows)


if __name__ == "__main__":
    main()
