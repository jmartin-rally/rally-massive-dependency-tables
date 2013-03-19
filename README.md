rally-massive-dependency-tables
===============================

A Rally app that displays predecessors and successor of items selected by tag. This uses
google tables so that it's easy to cut and paste the values into Excel.

NOTE: I have not updated the Rakefile to deal with this google thing. After compiling, 
you have to edit by hand to add the google junk.

in debug:

    <script type="text/javascript" src="https://www.google.com/jsapi"></script>

    <script type="text/javascript">
        google.load('visualization', '1', {packages:['table']});
        google.setOnLoadCallback(function() {
            Rally.loadScripts([
                "App.js"
            ], function() {
                Rally.launchApp('CustomApp', {
                    name: 'Dependency Report'
                });
            }, true);
        });
    </script>
    
    in the deploy one (after a new build), change the top to:
    
<!DOCTYPE html>
    <html>
    <head>
        <title>Dependency Report</title>
    
        <script type="text/javascript" src="/apps/2.0p5/sdk.js"></script>
    
        <script type="text/javascript" src="https://www.google.com/jsapi"></script>
    
        <script type="text/javascript">
            google.load('visualization', '1', {packages:['table']});
            google.setOnLoadCallback(function() {
                Ext.define('CustomApp', {
                        ...