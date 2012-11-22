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
import os
import sys

from ptstemmer.Stemmer import Stemmer
from xml.etree import ElementTree
from ptstemmer.exceptions.PTStemmerException import PTStemmerException
from ptstemmer.support.datastructures.SuffixTree import SuffixTree


class SavoyStemmer(Stemmer):
    '''
    Savoy Stemmer as defined in:
    J. Savoy, "Light stemming approaches for the French, Portuguese, German and Hungarian languages," Proceedings of the 2006 ACM symposium on Applied computing,  Dijon, France: ACM, 2006, pp. 1031-1035
    Implementation based on:
    http://members.unine.ch/jacques.savoy/clef/index.html
    @author: Pedro Oliveira
    '''
    
    def __init__(self):
        Stemmer.__init__(self)
        self.__pluralreductionrules = None
        self.__femininereductionrules = None
        self.__finalvowel = None 
        self.__readRulesFromXML()      
        
    def _stem(self,word): 
        return self.__algorithm(word)
    
    def __algorithm(self,word):
        length = len(word) -1
        
        if length > 2:
            word = self.__applyRules(word, self.__pluralreductionrules)
            length = len(word) -1
            if length > 5 and word[length] == 'a':
                word = self.__applyRules(word, self.__femininereductionrules)
            length = len(word) -1
            if length > 3 and (word[length] == 'a' or word[length] == 'e' or word[length] == 'o'):
                word = word[0:length]
            #self.__applyRules(word, self.__finalvowel)
        return word
    
    def __applyRules(self,word,rules):
        length = len(word) -1
        if length < rules.properties['size']:    #If the word is smaller than the minimum stemming size of this step, ignore it
            return word

        res = rules.getLongestSuffixesAndValues(word)

        for i in range(len(res)-1,-1,-1):
            suffix = res[i][0]
            rule = res[i][1]
            if length > rule[0]:
                return word[0:len(word)-len(suffix)]+rule[1]
        return word
    
    
    def __readRulesFromXML(self):
        try:
            doc = ElementTree.parse(os.path.join(os.path.dirname(os.path.abspath( __file__ )),'SavoyStemmerRules.xml'))
        except Exception, e:
            raise PTStemmerException,'Problem while parsing Savoy\'s XML stemming rules file ('+str(e)+')'
         
        root = doc.getroot()
            
        for step in root:

            try:
                stepName = step.attrib['name']
            except:
                raise PTStemmerException,'Problem while parsing Savoy\'s XML stemming rules file: Invalid step.'
            suffixes = SuffixTree()
            self.__setProperty(suffixes, 'size', 0, step)                      
            
            for rule in step:
                try:
                    size = rule.attrib['size']
                    replacement = rule.attrib['replacement']
                    suffix = rule.attrib['suffix']
                except:
                    raise PTStemmerException,'Problem while parsing Savoy\'s XML stemming rules file: Invalid rule in '+stepName+'.'

                try:
                    suffixes[suffix] = (int(size),replacement)
                except Exception,e:
                    raise PTStemmerException('Problem while parsing Savoy\'s XML stemming rules file: Missing or invalid rules properties on step '+stepName+'. ('+str(e)+')')

            if stepName == 'pluralreduction':
                self.__pluralreductionrules = suffixes
            elif stepName == 'femininereduction':
                self.__femininereductionrules = suffixes
            elif stepName == 'finalvowel':
                self.__finalvowel = suffixes
        
        if self.__pluralreductionrules == None or self.__femininereductionrules == None or self.__finalvowel == None:
            raise PTStemmerException('Problem while parsing Savoy\'s XML stemming rules file: Missing steps.')

    def __setProperty(self,tree,property,defaultValue,element):
        try:
            value = element[property]
            value = int(value)
            tree.properties[property] = value
        except:
            tree.properties[property] = defaultValue
            
            
if __name__ == '__main__':
    s = SavoyStemmer()
    print s.getWordStem('extremamente')

    