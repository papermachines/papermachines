#!/usr/bin/env python
# -*- coding: LATIN-1 -*-
'''
 * PTStemmer - A Stemming toolkit for the Portuguese language (C) 2008-2010 Pedro Oliveira
 * 
 * This file is part of PTStemmer.
 * PTStemmer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * PTStemmer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with PTStemmer. If not, see <http://www.gnu.org/licenses/>.
'''

from ptstemmer.Stemmer import Stemmer
from ptstemmer.support.datastructures.SuffixTree import SuffixTree

class PorterStemmer(Stemmer):
    '''
    Porter Stemmer as defined in:
    http://snowball.tartarus.org/algorithms/portuguese/stemmer.html
    @author: Pedro Oliveira
    '''
    __vowels = 'aeiouáéíóúâêô'
    __suffix1 = SuffixTree(True,['amentos', 'imentos', 'amento', 'imento', 'adoras', 'adores', 'aço~es', 'ismos', 'istas', 'adora', 'aça~o', 'antes', 'ância', 'ezas', 'icos', 'icas', 'ismo', 'ável', 'ível', 'ista', 'osos', 'osas', 'ador', 'ante', 'eza', 'ico', 'ica', 'oso', 'osa'])
    __suffix2 = SuffixTree(True,['logías', 'logía'])
    __suffix3 = SuffixTree(True,['uciones', 'ución'])
    __suffix4 = SuffixTree(True,['ências', 'ência'])
    __suffix5 = SuffixTree(True,['amente'])
    __suffix6 = SuffixTree(True,['mente'])
    __suffix7 = SuffixTree(True,['idades', 'idade'])
    __suffix8 = SuffixTree(True,['ivas', 'ivos', 'iva', 'ivo'])
    __suffix9 = SuffixTree(True,['iras', 'ira'])
    __suffixv = SuffixTree(True,['aríamos', 'eríamos', 'iríamos', 'ássemos', 'êssemos', 'íssemos', 'aríeis', 'eríeis', 'iríeis', 'ásseis', 'ésseis', 'ísseis', 'áramos', 'éramos', 'íramos', 'ávamos', 'aremos', 'eremos', 'iremos', 'ariam', 'eriam', 'iriam', 'assem', 'essem', 'issem', 'ara~o', 'era~o', 'ira~o', 'arias', 'erias', 'irias', 'ardes', 'erdes', 'irdes', 'asses', 'esses', 'isses', 'astes', 'estes', 'istes', 'áreis', 'areis', 'éreis', 'ereis', 'íreis', 'ireis', 'áveis', 'íamos', 'armos', 'ermos', 'irmos', 'aria', 'eria', 'iria', 'asse', 'esse', 'isse', 'aste', 'este', 'iste', 'arei', 'erei', 'irei', 'aram', 'eram', 'iram', 'avam', 'arem', 'erem', 'irem', 'ando', 'endo', 'indo', 'adas', 'idas', 'arás', 'aras', 'erás', 'eras', 'irás', 'avas', 'ares', 'eres', 'ires', 'íeis', 'ados', 'idos', 'ámos', 'amos', 'emos', 'imos', 'iras', 'ada', 'ida', 'ará', 'ara', 'erá', 'era', 'irá', 'ava', 'iam', 'ado', 'ido', 'ias', 'ais', 'eis', 'ira', 'ia', 'ei', 'am', 'em', 'ar', 'er', 'ir', 'as', 'es', 'is', 'eu', 'iu', 'ou'])
    __suffixr = SuffixTree(True,['os', 'a', 'i', 'o', 'á', 'í', 'ó'])
    __suffixf = SuffixTree(True,['e', 'é', 'ê'])


    def __init__(self):
        Stemmer.__init__(self)
    
    def _stem(self,word): 
        return self.__algorithm(word)
    
    def __algorithm(self,word):
        word = word.replace('ã', 'a~').replace('õ','~o')
        stem = word
        (r1,r2,rv) = self.__findRs(stem)
        stem = self.__step1(word, r1, r2, rv)

        if stem == word:
            stem = self.__step2(stem,r1,r2,rv)
        else:
            (r1,r2,rv) = self.__findRs(stem)

        if stem != word:
            (r1,r2,rv) = self.__findRs(stem)
            stem = self.__step3(stem,r1,r2,rv);
        else:
            stem = self.__step4(stem,r1,r2,rv)        

        if stem != word:
            (r1,r2,rv) = self.__findRs(stem)
        stem = self.__step5(stem,r1,r2,rv);

        stem = stem.replace('a~', 'ã').replace('~o','õ')
        return stem
    
    def __findRs(self,stem):
        r1 = self.__findR(stem)
        r2 = self.__findR(r1)
        rv = self.__findRV(stem)
        return (r1,r2,rv)
    
    def __step1(self,word,r1,r2,rv):
        
        suffix = self.__suffix1.getLongestSuffix(r2)
        if len(suffix) > 0:  #Rule 1
            return word[0: len(word)-len(suffix)]
        
        suffix = self.__suffix2.getLongestSuffix(r2)
        if len(suffix) > 0:    #Rule 2
            return word[0: len(word)-len(suffix)]+'log';
        
        suffix = self.__suffix3.getLongestSuffix(r2)
        if len(suffix) > 0:    #Rule 3
            return word[0: len(word)-len(suffix)]+'u';

        suffix = self.__suffix4.getLongestSuffix(r2)
        if len(suffix) > 0:    #Rule 4
            return word[0: len(word)-len(suffix)]+'ente';
        
        suffix = self.__suffix5.getLongestSuffix(r1)
        if len(suffix) > 0:     #Rule 5        
            word = word[0: len(word)-len(suffix)]
            if word.endswith('iv') and r2.endswith('iv'+suffix):
                word = word[0:len(word)-2]
                if word.endswith('at') and r2.endswith('ativ'+suffix):
                    word = word[0:len(word)-2]                   
            elif word.endswith('os') and r2.endswith('os'+suffix):
                word = word[0:len(word)-2]
            elif word.endswith('ic') and r2.endswith('ic'+suffix):
                word = word[0:len(word)-2]
            elif word.endswith('ad') and r2.endswith('ad'+suffix):
                word = word[0:len(word)-2]
            return word
        
        res = self.__execRule(self.__suffix6, word, r2, ('ante','ante',4),('avel','avel',4),('ível','ível',4) )
        if res:
            return res
        
        res = self.__execRule(self.__suffix7, word, r2, ('abil','abil',4),('ic','ic',2),('iv','iv',2) )
        if res:
            return res

        res = self.__execRule(self.__suffix8, word, r2, ('at','at',2))
        if res:
            return res
        
        suffix = self.__suffix9.getLongestSuffix(rv)
        if len(suffix) > 0:    #Rule 8
            if word.endswith('e'+suffix):
                return word[0:len(word)-len(suffix)]+'ir';
        return word        
                
    def __step2(self,word,r1,r2,rv):
        suffix = self.__suffixv.getLongestSuffix(rv)
        if len(suffix) > 0:
            return word[0:len(word)-len(suffix)]
        return word
    
    def __step3(self,word,r1,r2,rv):
        if rv.endswith('i')and word.endswith('ci'):
            return word[0:len(word)-1]
        return word
    
    def __step4(self,word,r1,r2,rv):
        suffix = self.__suffixr.getLongestSuffix(rv)
        if len(suffix) > 0:
            return word[0:len(word)-len(suffix)]
        return word
    
    def __step5(self,word,r1,r2,rv):
        res = self.__execRule(self.__suffixf, word, rv, ('gu','u',1), ('ci','i',1))
        if res:
            return res
        if word.endswith('ç'):
            word = word[0: len(word)-1]+'c'     
        return word
 
    def __findR(self,word):
        for i in range(len(word)-1):
            if word[i] in self.__vowels and word[i+1] not in self.__vowels:
                return word[i+2:]
        return ''
    
    def __findRV(self,word):
        if len(word) > 2:
            if word[1] not in self.__vowels:
                for i in range(2,len(word)-1):
                    if word[i] in self.__vowels:
                        return word[i+1:]
            elif word[0] in self.__vowels and word[1] in self.__vowels:
                for i in range(2,len(word)-1):
                    if word[i] not in self.__vowels:
                        return word[i+1:]
            else:
                return word[2:]
        return ''
    
    def __execRule(self, suffixTree, word, r, *conditions):
        suffix = suffixTree.getLongestSuffix(r)
        if len(suffix) > 0:
            word = word[0: len(word)-len(suffix)]           
            for condition in conditions:
                if word.endswith(condition[0])and r.endswith(condition[1]+suffix):
                    return word[0:len(word)-condition[2]]
            return word
        return None  
    
if __name__ == '__main__':
    s = PorterStemmer()   
    print s.getWordStem('televisivo')    