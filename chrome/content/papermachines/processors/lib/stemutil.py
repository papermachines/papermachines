#!/usr/bin/env python
import os
from java.lang import Class
from classpath import classPathHacker
from utils import memoize

# This function wraps the snowball stemmer library
# http://snowball.tartarus.org/dist/libstemmer_java.tgz
#
#
# javac org/tartarus/snowball/*.java org/tartarus/snowball/ext/*.java
# jar -cvf snowball.jar org

iso639_1 = {
    'ru': 'russian',
    'fr': 'french',
    'en': 'english',
    'pt': 'portuguese',
    'no': 'norwegian',
    'sv': 'swedish',
    'de': 'german',
    'tr': 'turkish',
    'it': 'italian',
    'da': 'danish',
    'fi': 'finnish',
    'hu': 'hungarian',
    'es': 'spanish',
    'nl': 'dutch',
}

stem_languages = set(iso639_1.values())

stemmers = {lang : None for lang in stem_languages}

def getLanguage(lang_code):
    if lang_code in iso639_1:
        lang = iso639_1[lang_code]
    elif lang_code in stem_languages:
        lang = lang_code
    return lang

def getStemmer(lang_code):
    global stemmers

    lang = getLanguage(lang_code)
    stemmer = stemmers.get(lang)
    if stemmer is None:
        stemClass = Class.forName("org.tartarus.snowball.ext." + lang + "Stemmer")
        stemmer = stemClass.newInstance()
        stemmers[lang] = stemmer
    return stemmer

@memoize
def stem(lang_code, word):
    global stemmers

    stemmer = getStemmer(lang_code)
    lang = getLanguage(lang_code)
    stemmers[lang].setCurrent(word)
    stemmers[lang].stem()
    return stemmers[lang].getCurrent()
