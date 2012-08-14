import sqlite3  
import pdb

# Higher scores should ALWAYS indicate a stronger/better relationship

class db:
    """
    This class interfaces to a sqlite database and has convienince methods for extracting data
    """
    def __init__(self, filename):
        self.con = sqlite3.connect(filename)
        self.cur = self.con.cursor() 
        self.loc = filename

    def __del__(self):
        self.con.commit()
        self.cur.close()
        self.con.close()

    def close(self):
        self.con.commit()
        self.cur.close()
        self.con.close()

    def get_db_loc(self):
        return self.loc
            
    def commit(self):
        self.con.commit()

    def fetch(self, stmt):
        self.cur.execute(stmt)
        return self.cur.fetchall()

    def execute(self, stmt, args=None):
        if args:
            self.cur.execute(stmt, args)
        else:
            self.cur.execute(stmt)
        self.commit()

    def executemany(self, stmt, itms):
        self.cur.executemany(stmt, itms)
        self.commit()
        
    def check_table_existence(self, table_name):
        qry = "SELECT name FROM sqlite_master WHERE type='table' AND name='%s'" % table_name
        self.cur.execute(qry)
        return self.cur.fetchall() != []
    
    def add_table(self, table):
        self.cur.execute('CREATE TABLE %s' % table)
        self.commit()
                         
    def add_index(self, index):
        self.cur.execute('CREATE INDEX %s' % index)
        self.commit()
    
    def get_topics_info(self, cutoff=-1):
        self.cur.execute('SELECT * FROM topics ORDER BY score DESC LIMIT ?', [cutoff])
        return self.cur.fetchall()

    def get_topic_info(self, topic_id):
        self.cur.execute('SELECT * FROM topics WHERE id=?', [topic_id])
        return self.cur.fetchall()

    def get_term_info(self, cutoff = -1):
        self.cur.execute('SELECT * FROM terms ORDER BY count DESC limit ?', [cutoff])
        return self.cur.fetchall()

    def get_term(self, term_id):
        self.cur.execute('SELECT * FROM terms WHERE id=? limit 1', [term_id])
        return self.cur.fetchall()

    def get_docs_info(self, cutoff=-1):
        self.cur.execute('SELECT * FROM docs LIMIT ?', [cutoff])
        return self.cur.fetchall()

    def get_doc_info(self, doc_id):
        self.cur.execute('SELECT * FROM docs WHERE id=?', [doc_id])
        return self.cur.fetchall()
        
    def get_topic_terms(self, topic_id, cutoff=-1):
        self.cur.execute('SELECT * FROM topic_term WHERE topic=? ORDER BY score DESC LIMIT ?', [topic_id, cutoff])
        return self.cur.fetchall()

    def get_top_topic_docs(self, topic_id, num=-1):                            
        self.cur.execute('SELECT * FROM doc_topic WHERE topic=? ORDER BY score DESC LIMIT ?', [topic_id,num])
        return self.cur.fetchall() 

    def get_top_term_docs(self, term_id, num=-1):
        self.cur.execute('SELECT * FROM doc_term WHERE term=? ORDER BY score DESC LIMIT ?', [term_id,num])
        return self.cur.fetchall()

    def get_top_topic_topics(self, topic_id, num=-1):
        self.cur.execute('SELECT * FROM topic_topic WHERE topic_a=? OR topic_b=? ORDER BY score DESC LIMIT ?', [topic_id, topic_id, num])
        return self.cur.fetchall()    

    def get_top_doc_docs(self, doc_id,num=-1):
        self.cur.execute('SELECT * FROM doc_doc WHERE doc_a=? OR doc_b=? ORDER BY score DESC LIMIT ?', [doc_id, doc_id, num])
        return self.cur.fetchall() 
    
    def get_top_doc_topics(self, doc_id, num=-1):
        self.cur.execute('SELECT * FROM doc_topic WHERE doc=? ORDER BY score DESC LIMIT ?', [doc_id, num])
        val = self.cur.fetchall() 
        return val 

    def get_top_term_terms(self, term_id, num=-1):
        self.cur.execute('SELECT * FROM term_term WHERE term_a=? OR term_b=? ORDER BY score DESC LIMIT ?', [term_id, term_id, num])

    def get_top_term_topics(self, term_id, num = 1):
        self.cur.execute('SELECT * FROM topic_term WHERE term=? ORDER BY score DESC LIMIT ?', [term_id, num])
        return self.cur.fetchall()         
        
    def get_doc_occ(self, term_id):
        self.cur.execute('SELECT doc FROM term_doc_pair WHERE term=?', [term_id])
        return self.cur.fetchall() 
        
    def get_prestem(self, term_id):
        self.cur.execute('SELECT prestem FROM termid_to_prestem WHERE id=?', [term_id])
        return self.cur.fetchall() 
        
    def insert_term_doc_pair(self, term_id, doc_id):
        self.cur.execute('INSERT INTO term_doc_pair(id, term, doc) VALUES(NULL, ?, ?)', [term_id, doc_id]) 

    def insert_termid_prestem(self, term_id, prestem):
         self.cur.execute('INSERT INTO termid_to_prestem(id, prestem) VALUES(?, ?)', [term_id, prestem])
         
    ## Wiki methods    
    
    def get_wiki_cocc(self, t1, t2, max_val):
        """
        obtain the cooccurence of t1_id and t2_id in the wikipedia abstracts
        make sure to first clean and stem the terms using TextCleaner in tma_util

        @return: co_occ
        """
        
        # make sure the terms are ordered correctly for querying
        t1 = int(t1)
        t2 = int(t2)
        if cmp(t2, t1) == -1:
            tvals = (t2,t1, max_val + 1)
        else:
            tvals = (t1, t2, max_val + 1)
        
        self.cur.execute('SELECT occ FROM co_occ WHERE term1=? AND term2=? AND occ < ? LIMIT 1', tvals) # 'LIMIT 1' decreases query time TODO add a < min(occ) clause? run some tests
        coocc = self.cur.fetchall()
        if not coocc == []:
            coocc = coocc[0][0]
        else:
            coocc = 0

        return coocc
        
    def get_wiki_occ(self, term):
        """
        obtain the occurence of term in the wikipedia abstracts
        make sure to first clean and stem term using TextCleaner in tma_util
        
        @return [term_id, term_occ]
        """     
        
        self.cur.execute("SELECT id, occ FROM dict WHERE term='%s' LIMIT 1" % term)
        res = self.cur.fetchall()    

        if not res == []:
            res = [res[0][0], res[0][1]]
            
        return res
        
        
        
        
        
