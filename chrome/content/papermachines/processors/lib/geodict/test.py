#!/usr/bin/python
import jsqlite3

con = jsqlite3.connect("geodict.db")
cur = con.cursor()
cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE name = ?;",['cities'])
print cur.fetchone()
