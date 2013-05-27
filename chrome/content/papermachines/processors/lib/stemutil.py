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

@memoize
def stem(lang_code, cwd, word):
    global stemmers

    if lang_code in iso639_1:
        lang = iso639_1[lang_code]
    elif lang_code in stem_languages:
        lang = lang_code

    if stemmers.get(lang) is None:
        jarLoad = classPathHacker()
        snowballPath = os.path.join(cwd, "lib", "snowball.jar")
        jarLoad.addFile(snowballPath)

        stemClass = Class.forName("org.tartarus.snowball.ext." + lang + "Stemmer")
        stemmer = stemClass.newInstance()
        stemmers[lang] = stemmer
    stemmers[lang].setCurrent(word)
    stemmers[lang].stem()
    return stemmers[lang].getCurrent()
