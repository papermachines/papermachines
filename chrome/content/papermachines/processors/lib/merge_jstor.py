#!/usr/bin/env python2.7

import csv, sys, os, shutil, logging

def merge_dfr_dirs(dirlist):
    merged_dir =  dirlist[-1] + "-merged"
    header_written = False

    wordcounts_dir = os.path.join(merged_dir, "wordcounts")

    for path in [merged_dir, wordcounts_dir]:
        if not os.path.exists(path):
            os.makedirs(path)

    dois = set()

    with file(os.path.join(merged_dir, "citations.CSV"), 'wb') as f:
        for dirname in dirlist:
            these_wordcounts = os.path.join(dirname, "wordcounts")
            for filename in os.listdir(these_wordcounts):
                shutil.copy(os.path.join(these_wordcounts, filename), wordcounts_dir)
            with file(os.path.join(dirname, "citations.CSV"), 'rb') as g:
                lines = g.__iter__()
                if not header_written:
                    f.write(lines.next())
                    header_written = True
                else:
                    lines.next() #skip header if already written
                for line in lines:
                    doi = line.split(',')[0]
                    if doi not in dois: #prevent repeats
                        f.write(line)
                        dois.add(doi)
    return merged_dir
