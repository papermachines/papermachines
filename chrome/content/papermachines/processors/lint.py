#!/usr/bin/python
"""
custom script that calls pylint with a special set of parameters.
"""
import sys
import os

# check if pylint is installed and import it
try:
    from pylint import lint
except ImportError:
    print "Can't import module pylint. Did you install it?"
    sys.exit(-1)

# either use the files given on the command line or all '*.py' files
# located in and beyond the working directory
if len(sys.argv) >1:
    #may add some parsing for --switches?
    FILES = sys.argv[1:]
else:
    FILES = []
    for dirpath, dirnames, filenames in os.walk(os.getcwd()):
        FILES.extend(
            os.path.join(dirpath, filename)
            for filename in filenames
            if ".py" == filename[-3:]
        )

# A list of messages that should not be printed by pylint.
SUPRESSED_MESSAGES = [
    'I0011', # Used when an inline option disable a message or a messages
             # category.
# If you decided to globally switch of a certain message instead of doing so
# in file or scope where its generated then you can just uncomment it here.
# Or add it if its not in the list.
#   'E1101', # Used when a class is accessed for an unexistant member.
#   'E0602', # Used when an undefined variable is accessed.
#   'W0232', # Used when a class has no __init__ method, neither its parent
#            # classes.
#   'W0401', # Used when `from module import *` is detected.
#   'W0611', # Used when an imported module or variable is not used.
#   'R0201', # Used when a method doesn't use its bound instance, and so could
#            # be written as a function.
#   'R0801', # Indicates that a set of similar lines has been detected among
#            # multiple file.
]

PARAMS = [
    '--reports=n', '--include-ids=y',
          '--disable=%s' % ",".join(SUPRESSED_MESSAGES),
]
PARAMS.extend(FILES)
lint.Run(PARAMS)
