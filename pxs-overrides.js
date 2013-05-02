/*
 * Override to try to force POST for queryies instead of a GET so we're not
 * constrained to URL.
 * 
 * NOTE: THIS DOES NOT WORK WHEN RUN OUTSIDE OF RALLY!
 */
 Ext.override(Ext.data.proxy.Rest,{
    actionMethods: {
        create : 'POST',
        read   : 'POST',
        update : 'PUT',
        destroy: 'DELETE'
    },
    headers: { 'Content-Type': 'application/json' } 
 });
 
Ext.override(Rally.data.lookback.SnapshotRestProxy,{
    buildRequest: function(operation) {
        var request = this.callParent(arguments);
        Ext.apply(request.params, {
            fields: this._encodeFetch(),
            hydrate: this._encodeHydrate(),
            pagesize: operation.limit,
            start: operation.start
        });

        //Always encode filters
        if (!request.params[this.filterParam]) {
            request.params[this.filterParam] = this.encodeFilters(this.filters, this.rawFind);
        }
        
        // encode for packaging
        request.params = Ext.JSON.encode(request.params);
        return request;
    }
});

// Ext.override(Ext.data.proxy.Ajax,{
//    getMethod: function(request) {
//        return "POST";
//    }
// });
