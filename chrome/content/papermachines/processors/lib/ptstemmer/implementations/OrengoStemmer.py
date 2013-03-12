#!/usr/bin/env python
# -*- coding: utf-8
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
import os

from ptstemmer.Stemmer import Stemmer
from xml.etree import ElementTree
from ptstemmer.exceptions.PTStemmerException import PTStemmerException
from ptstemmer.support.datastructures.SuffixTree import SuffixTree


class OrengoStemmer(Stemmer):
    '''
    Orengo Stemmer as defined in:
    V. Orengo and C. Huyck, "A stemming algorithm for the portuguese language," String Processing and Information Retrieval, 2001. SPIRE 2001. Proceedings.Eighth International Symposium on, 2001, pp. 186-193.
    Added extra stemming rules and exceptions found in:
    http://www.inf.ufrgs.br/%7Earcoelho/rslp/integrando_rslp.html
    @author: Pedro Oliveira
    '''
    class Rule(object):
        def __init__(self,size,replacement=None,exceptions=None):
            self.size = size
            if replacement is None:
                self.replacement = replacement
            else:
                self.replacement = ''
            self.exceptions = SuffixTree(True,exceptions)

    def __init__(self):
        Stemmer.__init__(self)
        self.__pluralreductionrules = None
        self.__femininereductionrules = None
        self.__adverbreductionrules = None
        self.__augmentativediminutivereductionrules = None
        self.__nounreductionrules = None
        self.__verbreductionrules = None
        self.__vowelremovalrules = None
        self.__readRulesFromXML()
    
    def _stem(self,word): 
        return self.__algorithm(word)
    
    def __algorithm(self,word):
        stem = word
        end = word[len(stem)-1]       
        if end == 's':
            stem = self.__applyRules(stem, self.__pluralreductionrules)
        end = word[len(stem)-1]
        if end == 'a' or end == 'ã':
            stem = self.__applyRules(stem, self.__femininereductionrules)
        stem = self.__applyRules(stem, self.__augmentativediminutivereductionrules)
        stem = self.__applyRules(stem, self.__adverbreductionrules)     
        aux = stem
        stem = self.__applyRules(stem, self.__nounreductionrules)
        if aux == stem:
            stem = self.__applyRules(stem, self.__verbreductionrules)
            if aux == stem:
                stem = self.__applyRules(stem, self.__vowelremovalrules)
                
        return stem
    
    def __applyRules(self,word,rules):
        if len(word) < rules.properties['size']:    #If the word is smaller than the minimum stemming size of this step, ignore it
            return word

        res = rules.getLongestSuffixesAndValues(word)

        for i in range(len(res)-1,-1,-1):
            suffix = res[i][0]
            rule = res[i][1]
            if rules.properties['exceptions'] == 1 and word in rule.exceptions: #Compare entire word with exceptions
                break
            if  rule.exceptions.getLongestSuffixValue(word) != None:   #Compare only the longest suffix
                break
            if len(word) >= len(suffix)+rule.size:
                return word[0:len(word)-len(suffix)]+rule.replacement
        return word
                
    def __readRulesFromXML(self):
        try:
            doc = ElementTree.parse(os.path.join(os.path.dirname(os.path.abspath( __file__ )),'OrengoStemmerRules.xml'))
        except Exception, e:
            raise PTStemmerException,'Problem while parsing Orengo\'s XML stemming rules file ('+str(e)+')'
         
        root = doc.getroot()
            
        for step in root:
            try:
                stepName = step.attrib['name']
            except:
                raise PTStemmerException,'Problem while parsing Orengo\'s XML stemming rules file: Invalid step.'
            
            suffixes = SuffixTree()
            self.__setProperty(suffixes, 'size', 0, step)
            self.__setProperty(suffixes, 'exceptions', 0, step)                        
            
            for rule in step:
                try:
                    size = rule.attrib['size']
                    replacement = rule.attrib['replacement']
                    suffix = rule.attrib['suffix']
                except:
                    raise PTStemmerException,'Problem while parsing Orengo\'s XML stemming rules file: Invalid rule in '+stepName+'.'
                
                exceptions = []
                for exception in rule:
                    try:
                        exceptions.append(exception.text)
                    except:
                        raise PTStemmerException,'Problem while parsing Orengo\'s XML stemming rules file: Invalid exception in step '+stepName+', rule '+suffix
                 
                try:
                    r = self.Rule(int(size),replacement,exceptions)
                except Exception,e:
                    raise PTStemmerException('Problem while parsing Orengo\'s XML stemming rules file: Missing or invalid rules properties on step '+stepName+'. ('+str(e)+')')
                
                suffixes[suffix] = r
            
            if stepName == 'pluralreduction':
                self.__pluralreductionrules = suffixes
            elif stepName == 'femininereduction':
                self.__femininereductionrules = suffixes
            elif stepName == 'adverbreduction':
                self.__adverbreductionrules = suffixes
            elif stepName == 'augmentativediminutivereduction':
                self.__augmentativediminutivereductionrules = suffixes
            elif stepName == 'nounreduction':
                self.__nounreductionrules = suffixes
            elif stepName == 'verbreduction':
                self.__verbreductionrules = suffixes
            elif stepName == 'vowelremoval':
                self.__vowelremovalrules = suffixes
        
        if self.__pluralreductionrules == None or self.__femininereductionrules == None or self.__adverbreductionrules == None or self.__augmentativediminutivereductionrules == None or self.__nounreductionrules == None or self.__verbreductionrules == None or self.__vowelremovalrules == None:
            raise PTStemmerException('Problem while parsing Orengo\'s XML stemming rules file: Missing steps.')


    def __setProperty(self,tree,property,defaultValue,element):
        try:
            value = element[property]
            value = int(value)
            tree.properties[property] = value
        except:
            tree.properties[property] = defaultValue
                
if __name__ == '__main__':
    s = OrengoStemmer()
    print s.getWordStem('extremamente')
