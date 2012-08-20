import sqlite3, string, StringIO
import geodict_config


def get_database_connection():
    db=sqlite3.connect(geodict_config.database+'.db')
    cursor=db.cursor()
    return cursor
    
def get_cities(pulled_word,current_word,country_code,region_code):
    cursor = get_database_connection()
    select = 'SELECT * FROM cities WHERE last_word=?'
    values = (pulled_word, )
    if country_code is not None:
        select += ' AND country=?'

    if region_code is not None:
        select += ' AND region_code=?'

    # There may be multiple cities with the same name, so pick the one with the largest population
    select += ' ORDER BY population;'
    # Unfortunately tuples are immutable, so I have to use this logic to set up the correct ones
    if country_code is None and region_code is None:
        values = (current_word, )
    elif country_code is not None and region_code is None:
        values = (current_word, country_code)
    elif country_code is None and region_code is not None:
        values = (current_word, region_code)
    else:
        values = (current_word, country_code, region_code)

    values = [v.lower() for v in values]

    cursor.execute(select, values)
    candidate_rows = cursor.fetchall()
    # print candidate_rows

    name_map = {}
    for candidate_row in candidate_rows:
        # print candidate_row
        candidate_dict = get_dict_from_row(cursor, candidate_row)
        # print candidate_dict
        name = candidate_dict['city'].lower()
        name_map[name] = candidate_dict
    return name_map

# Converts the result of a MySQL fetch into an associative dictionary, rather than a numerically indexed list
def get_dict_from_row(cursor, row):
    d = {}
    for idx,col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

# Functions that look at a small portion of the text, and try to identify any location identifiers

# Caches the countries and regions tables in memory

def setup_countries_cache():
    countries_cache = {}
    cursor = get_database_connection()
    select = 'SELECT * FROM countries;'
    cursor.execute(select)
    candidate_rows = cursor.fetchall()

    for candidate_row in candidate_rows:
        candidate_dict = get_dict_from_row(cursor, candidate_row)
        last_word = candidate_dict['last_word'].lower()
        if last_word not in countries_cache:
            countries_cache[last_word] = []
        countries_cache[last_word].append(candidate_dict)
    return countries_cache

def setup_regions_cache():
    regions_cache = {}
    cursor = get_database_connection()
    select = 'SELECT * FROM regions;'
    cursor.execute(select)
    candidate_rows = cursor.fetchall()

    for candidate_row in candidate_rows:
        candidate_dict = get_dict_from_row(cursor, candidate_row)
        last_word = candidate_dict['last_word'].lower()
        if last_word not in regions_cache:
            regions_cache[last_word] = []
        regions_cache[last_word].append(candidate_dict)
    return regions_cache

def is_initialized(name):
    cursor = get_database_connection()
    cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE name = ?;",[name])
    return cursor.fetchone()[0] > 0

