class classPathHacker:
##########################################################
# from http://forum.java.sun.com/thread.jspa?threadID=300557
#
# Author: SG Langer Jan 2007 translated the above Java to this
#       Jython class
# Purpose: Allow runtime additions of new Class/jars either from
#       local files or URL
######################################################
    import java.lang.reflect.Method
    import java.io.File
    import java.net.URL
    import java.net.URLClassLoader
    import jarray

    def addFile (self, s):
        #############################################
        # Purpose: If adding a file/jar call this first
        #       with s = path_to_jar
        #############################################

        # make a URL out of 's'
        f = self.java.io.File (s)
        u = f.toURL ()
        a = self.addURL (u)
        return a

    def addURL (self, u):
        ##################################
        # Purpose: Call this with u= URL for
        #       the new Class/jar to be loaded
        #################################

        parameters = self.jarray.array([self.java.net.URL], self.java.lang.Class)
        sysloader =  self.java.lang.ClassLoader.getSystemClassLoader()
        sysclass = self.java.net.URLClassLoader
        method = sysclass.getDeclaredMethod("addURL", [self.java.net.URL])
        a = method.setAccessible(1)
        b = method.invoke(sysloader, [u])
        return u
