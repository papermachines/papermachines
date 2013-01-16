#!/usr/bin/env python
import porter2
import sys, os, inspect

cmd_folder = os.path.realpath(os.path.abspath(os.path.split(inspect.getfile( inspect.currentframe() ))[0]))
if cmd_folder not in sys.path:
	sys.path.insert(0, cmd_folder)

# use this if you want to include modules from a subfolder
cmd_subfolder = os.path.realpath(os.path.abspath(os.path.join(os.path.split(inspect.getfile( inspect.currentframe() ))[0],"lib")))
if cmd_subfolder not in sys.path:
	sys.path.insert(0, cmd_subfolder)

_orengostemmer = None

def stem(caller, word):
	global _orengostemmer

	lang = getattr(caller, "lang", "en")
	if lang == "en":
		return porter2.stem(word)
	elif lang == "pt":
		if _orengostemmer is None:
			from ptstemmer.implementations.OrengoStemmer import OrengoStemmer
			_orengostemmer = OrengoStemmer()
		return _orengostemmer.getWordStem(word)
	else:
		return word
