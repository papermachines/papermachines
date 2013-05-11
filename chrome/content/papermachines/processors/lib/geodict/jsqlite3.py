#!/usr/bin/env python2.7
import sys, os, logging
from java.lang import Class

from java.sql import Connection, DriverManager, ResultSet, ResultSetMetaData, SQLException, Statement, PreparedStatement

def connect(db_name):
    return SqliteDB(db_name)

def getConnection(jdbc_url, driverName):
    """
            Given the name of a JDBC driver class and the url to be used
            to connect to a database, attempt to obtain a connection to
            the database.
    """
    try:
        Class.forName(driverName).newInstance()
    except Exception, msg:
        logging.error(msg)
        sys.exit(-1)

    try:
        dbConn = DriverManager.getConnection(jdbc_url)
    except SQLException, msg:
        logging.error(msg)
        sys.exit(-1)

    return dbConn

class SqliteDB:
    def __init__(self, name):
        self.connection = getConnection("jdbc:sqlite:"+name, "org.sqlite.JDBC")
    def cursor(self):
        return FakeCursor(self.connection)

class FakeCursor:
    def __init__(self, connection):
        self.connection = connection
        self.statement = None
        self.results = None
        self.types = None
        self.columns = None

    def execute(self, query, values = []):
        self.results = None
        self.types = None
        self.columns = None
        self.statement = self.connection.prepareStatement(query)
        for i, v in enumerate(values):
            i = i + 1
            if isinstance(v, basestring):
                self.statement.setString(i, v)
            else:
                self.statement.setInt(i, v)
        self.results = self.statement.executeQuery()

    @property
    def description(self):
        if self.results is not None:
            self.columns = []
            self.types = []
            md = self.results.getMetaData()
            for i in range(md.getColumnCount()):
                i = i + 1
                this_type = md.getColumnTypeName(i)
                self.types.append(this_type)
                self.columns.append((md.getColumnName(i), this_type))
            return self.columns

    def fetchall(self):
        cols = self.description
        return self.fetchall_iter()

    def fetchall_iter(self):
        while self.results.next():
            yield self.row_inner()

    def row_inner(self):
        row = []
        for i, t in enumerate(self.types):
            i = i + 1
            if t == 'text':
                row.append(self.results.getString(i))
            elif t == 'integer':
                row.append(self.results.getInt(i))
            elif t == 'float':
                row.append(self.results.getFloat(i))
        return row

    def fetchone(self):
        cols = self.description
        self.results.next()
        return self.row_inner()
