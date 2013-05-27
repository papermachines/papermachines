#!/usr/bin/python
# -*- coding: utf-8 -*-

import re
import os

from jarray import array

from java.util import ArrayList
from java.lang import String
from java.io import File, FileFilter, BufferedReader, \
    InputStreamReader, FileInputStream
from java.util.regex import Pattern

from cc.mallet.pipe import Target2Label, SaveDataInSource, \
    Input2CharSequence, CharSequence2TokenSequence, \
    TokenSequenceLowercase, TokenSequenceRemoveStopwords, \
    TokenSequence2FeatureSequence, FeatureCountPipe, \
    FeatureDocFreqPipe, SerialPipes

from cc.mallet.pipe.iterator import CsvIterator, FileListIterator
from cc.mallet.types import InstanceList
from cc.mallet.util import CharSequenceLexer

from textprocessor import TextProcessor


class FileFilterRegex(FileFilter):

    def __init__(self, ffilter):
        self.ffilter = re.compile(ffilter)

    def accept(self, file_to_test):
        filename = file_to_test.getCanonicalPath()
        return self.ffilter.search(filename) is not None


class MalletImport(TextProcessor):

    ''' Create MALLET instances from texts '''

    encoding = 'UTF-8'

    def create_instance_list(self, list_type):
        ''' Create a MALLET instance list.
        list_type: one of ('files', 'csv', 'tokenseq')
        '''
        if getattr(self, 'instance_list', None) is None:
            tokenPattern = \
                Pattern.compile(CharSequenceLexer.LEX_ALPHA.toString())
            pipeList = ArrayList()
            pipeList.add(Target2Label())
            if list_type in ('files', 'csv'):
                if list_type == 'files':
                    pipeList.add(SaveDataInSource())
                    pipeList.add(Input2CharSequence(self.encoding))
                pipeList.add(CharSequence2TokenSequence())
            pipeList.add(TokenSequenceLowercase())
            pipeList.add(TokenSequenceRemoveStopwords(File(self.stoplist),
                         self.encoding, False, False, False))
            pipeList.add(TokenSequence2FeatureSequence())
            self.instance_list = InstanceList(SerialPipes(pipeList))

    def import_mallet_text_file(self):
        ''' Import a tab-separated text file containing all docs '''

        self.create_instance_list('csv')

        reader = BufferedReader(
                    InputStreamReader(
                        FileInputStream(File(self.texts_file)),
                        self.encoding
                    )
                )
        linePattern = Pattern.compile('^([^\t]*)[\t]([^\t]*)[\t](.*)$')
        self.instance_list.addThruPipe(CsvIterator(reader, linePattern,
                3, 2, 1))
        reader.close()
        return self.instance_list

    def import_file_list(self):
        ''' Import a list of text files '''

        self.create_instance_list('files')

        ffilter = FileFilterRegex('\.txt')
        file_list = [File(x) for x in self.files]
        instances.addThruPipe(FileListIterator(array(file_list, File),
                              ffilter, FileListIterator.LAST_DIRECTORY,
                              True))
        return self.instance_list

    def write_instances(self):
        self.instance_list.save(File(self.instance_file))

if __name__ == '__main__':


    class MalletImportTest(MalletImport):

        def __init__(self):
            self.stoplist = 'stopwords/stopwords_en.txt'
            files = os.listdir('/Users/chrisjr/pm/559764C40')
            self.files = [os.path.join('/Users/chrisjr/pm/559764C40',
                          x) for x in files
                          if re.search('(?<!_tags)\.txt', x)
                          is not None]


    mallet_import = MalletImportTest()
    instances = mallet_import.import_file_list()
