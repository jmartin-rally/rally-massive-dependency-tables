Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
            { xtype: 'container', itemId: 'selector_box', padding: 15, defaults: { padding: 15 }, html: "--selectors to be supplied--" },
            { xtype: 'container', itemId: 'table_box', defaults: { padding: 5 } }
        ],
    our_hash: {}, /* key is object id, content is the story from our project associated with that object id */
    other_hash: {}, /* key is object id, content is the story associated with that object id */
    timebox_hash: {}, /* key is object id of iteration or release. Changed both to have EndDate */
    project_hash: {}, /* key is object id of projecs */
    launch: function() {
        var me = this;
        me._getBaseData();
    	//me._getDependencies();
    },
    log: function( msg ) {
    	var me = this;
//    	if ( ( typeof(msg) == "object" ) && ( msg.length ) ) {
//    		Ext.Array.each( msg, function( one_msg ) { me.log( one_msg ); } );
//    	} else {
    		window.console && console.log( new Date(), msg );
//    	}
    },
    /**
     * We can't send a very long query, so we'll get our timeboxes and other stories first.  
     * 
     */
    _getBaseData: function() {
        this._getProjects();
    },
    _getDependencies: function() {
        this._getOurItems("Successors");
        this._getOurItems("Predecessors");
    },
    _getProjects: function() {
        var me = this;
        me.log( "_getProjects");
        Ext.create('Rally.data.WsapiDataStore',{
            context: {project: null},
            autoLoad: true,
            model: 'Project',
            limit: 5000,
            fetch: [ 'ObjectID', 'Name' ],
            filters: { property: "State", operator: "!=", value: "Closed" },
            listeners: {
                load: function( store, data, success ) {
                    var data_length = data.length;
                    me.log( data_length );
                    for ( var i=0; i<data_length; i++ ) {
                        me.project_hash[ data[i].get('ObjectID') ] = { Name: data[i].get('Name') };
                    }
                    me._getTimeboxes();
                }
            }
        });
    },
    _getTimeboxes: function() {
        var me = this;
        me.log( "_getTimeboxes" );
        Ext.create('Rally.data.WsapiDataStore',{
            context: {project: null},
            autoLoad: true,
            model: 'Release',
            limit: 5000,
            fetch: [ 'ObjectID', 'ReleaseDate' ],
            filters: { property: "ObjectID", operator: ">", value: 0 },
            listeners: {
                load: function( store, data, success ) {
                    var data_length = data.length;
                    me.log( data_length );
                    for ( var i=0; i<data_length; i++ ) {
                        me.timebox_hash[ data[i].get('ObjectID') ] = { EndDate: data[i].get('ReleaseDate') };
                    }
                    me._getIterations();
                }
            }
        });
    },
    _getIterations: function() {
        var me = this;
        me.log( "_getIterations " );
        
        Ext.create('Rally.data.WsapiDataStore',{
            context: { project: null },
            autoLoad: true,
            limit: 5000,
            model: 'Iteration',
            fetch: [ 'ObjectID', 'EndDate' ],
            filters: { property: "ObjectID", operator: ">", value: 0 },
            listeners: {
                load: function( store, data, success ) {
                    var data_length = data.length;
                    me.log( data_length );
                    for ( var i=0; i<data_length; i++ ) {
                        me.timebox_hash[ data[i].get('ObjectID') ] = { EndDate: data[i].get('EndDate') };
                    }
                    me._getDependencies();
                }
            }
        });
    },
    _getOurItems: function( type ) {
    	var me  = this;
    	Ext.create('Rally.data.lookback.SnapshotStore',{
    		autoLoad: true,
    		limit: 1000,
    		fetch: ['Name','_ItemHierarchy',type, 'ScheduleState', 'Project', 'Iteration', 'Release', '_UnformattedID' ],
            hydrate: [ 'ScheduleState' ],
    		filters: [ {
	        	  property: '__At',
	        	  operator: '=',
	        	  value: 'current'
	          },
	          {
	        	  property: type,
	        	  operator: '!=',
	        	  value: null
	          },
	          {
	        	  property: '_ProjectHierarchy',
	        	  operator: '=',
	        	  value: me.getContext().getProject().ObjectID
	          }],
    		listeners: {
    			load: function( store, data, success ) {
    				me._createRowPerDependency( type, data );
    			}
    		}
    	});
    },
    _createRowPerDependency: function( type, data ) {
        var me = this;
        me.log( [ "_createRowPerDependency " + type, data.length ] );
        var number_of_items_with_dependencies = data.length;
        var rows = [];
        
        var direction = "Provides";
        if ( type === "Predecessors" ) {
            direction = "Receives";
        }
        
        for ( var i=0; i<number_of_items_with_dependencies; i++ ) {
            var dependent_ids = data[i].get(type);
            me.our_hash[ data[i].get('ObjectID') ] = data[i].data;
            
            for ( var j=0; j< dependent_ids.length; j++ ) {
		        rows.push({
                    epic: false,
                    epic_report: "",
                    object_id: data[i].get('ObjectID'),
		            direction: direction,
		            project: data[i].get('Project'),
		            name: "US" + data[i].get('_UnformattedID') + ": " + data[i].get('Name') ,
		            schedule_state: data[i].get('ScheduleState'),
		            release: data[i].get('Release'),
		            iteration: data[i].get('Iteration'),
                    iteration_name: "",
		            release_date: null,
		            iteration_date: null,
                    other_id: dependent_ids[j],
		            other_project: 'tbd',
		            other_name: 'tbd',
                    other_epic: false,
                    other_epic_report: "",
		            other_schedule_state: 'tbd',
		            other_release: null,
		            other_iteration: null,
		            other_release_date: null,
		            other_iteration_date: null,
		            tags: ''
		        });
            }
        }
        me.log( ["rows",rows, "our_hash", me.our_hash ] );
        me._getLeaves( type,rows );
    },
/**
 * having trouble when we have more than 300 items to look for at once
 */
    _getLeaves: function(type,rows) {
        var me = this;
        me.log("_getLeaves: " + type);     
        var row_length = rows.length;
        var very_long_array = [];
        for ( var i=0;i<row_length;i++ ) {
            very_long_array.push(rows[i].object_id);
            very_long_array.push(rows[i].other_id);   
        }
        me._doNestedLeavesArray( type, rows, very_long_array, 0 );         
    },
    _doNestedLeavesArray: function( type, rows, very_long_array, start_index ) {
        var me = this;
        me.log( [ "_doNestedArray", start_index, very_long_array ] );
        var gap = 300;
        var sliced_array = very_long_array.slice(start_index, start_index + gap);
        
        var query = Ext.create('Rally.data.lookback.QueryFilter',{
            property: '_ItemHierarchy', operator: 'in', value: sliced_array
        }).and( Ext.create('Rally.data.lookback.QueryFilter',{
            property: '_TypeHierarchy', operator: '=', value: "HierarchicalRequirement"
        })).and( Ext.create('Rally.data.lookback.QueryFilter',{
            property: 'Children', operator: '=', value: null
        }));
        query = query.and(Ext.create('Rally.data.lookback.QueryFilter',{property: '__At', operator: '=',value: 'current' }));
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            limit: gap,
            fetch: ['Name', '_ItemHierarchy', 'Iteration', 'Release' ],
            filters: query,
            listeners: {
                load: function( store, data, success ) {
                    var data_length = data.length;
                    me.log( "load leaves snapshot" );
                    for ( var i=0;i<data_length;i++ ) {
                        // only care if this is the child of one we already got
                        if ( data[i].get('_ItemHierarchy').length > 1 ) {
                            var top_id = data[i].get('_ItemHierarchy')[0];
                            var bottom_id = data[i].get('ObjectID');
                            if ( me.our_hash[ top_id ] ) {
                                if ( ! me.our_hash[top_id].children ) {
                                    me.our_hash[top_id].scheduled_children = [];
                                    me.our_hash[top_id].children = [];
                                }
                                if ( me.our_hash[top_id].children.indexOf(bottom_id) ==-1 ) {
                                    me.our_hash[top_id].children.push( bottom_id );
	                                if ( ( data[i].get('Iteration') ) || ( data[i].get('Release') ) ) {
	                                    me.our_hash[top_id].scheduled_children.push( bottom_id );
	                                }
                                }
                            } else if ( me.other_hash[top_id] ) {
                                if ( ! me.other_hash[top_id].children ) {
                                    me.other_hash[top_id].scheduled_children = [];
                                    me.other_hash[top_id].children = [];
                                }
                                if ( me.other_hash[top_id].children.indexOf(bottom_id) ==-1 ) {
                                    me.other_hash[top_id].children.push( bottom_id );
                                    if ( ( data[i].get('Iteration') ) || ( data[i].get('Release') ) ) {
                                        me.other_hash[top_id].scheduled_children.push( bottom_id );
                                    }
                                }
                            } else {
                                me.other_hash[top_id] = {
                                    scheduled_children: [],
                                    children: [bottom_id]
                                };
                                if ( ( data[i].get('Iteration') ) || ( data[i].get('Release') ) ) {
                                    me.other_hash[top_id].scheduled_children.push( bottom_id );
                                }
                            }
                        }
                    }
                    start_index = start_index + gap;
                    if ( start_index < very_long_array.length ) {
                        me._doNestedLeavesArray( type, rows, very_long_array, start_index );
                    } else {
                        me._getOtherData(type,rows);
                    }
                }
            }
        });
    },    
    /**
     * having trouble when we have more than 300 items to look for at once
     */
    _getOtherData: function(type,rows) {
        var me = this;
        me.log("_getOtherData " + type);
//        
        var row_length = rows.length;
        var other_id_array = [];
        for ( var i=0;i<row_length;i++ ) {
            other_id_array.push(rows[i].other_id);   
        }
        
        me._doNestedOtherArray( type, rows, other_id_array, 0 ); 
    },
    _doNestedOtherArray: function( type, rows, other_id_array, start_index ) {
        var me = this;
        var gap = 300;
        var sliced_array = other_id_array.slice(start_index, start_index + gap);
        
        var query = Ext.create('Rally.data.lookback.QueryFilter',{
            property: 'ObjectID', operator: 'in', value: sliced_array
        });
        query = query.and(Ext.create('Rally.data.lookback.QueryFilter',{property: '__At', operator: '=',value: 'current' }));
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            limit: gap,
            fetch: ['Name','_ItemHierarchy', 'ScheduleState', 'Project', 'Iteration', 'Release' ],
            hydrate: [ 'ScheduleState' ],
            filters: query,
            listeners: {
                load: function( store, data, success ) {
                    var data_length = data.length;
                    for ( var i=0;i<data_length;i++ ) {
                        if ( ! me.other_hash[data[i].get('ObjectID')] ) {
                            me.other_hash[ data[i].get('ObjectID') ] = data[i].data;
                        } else {
                            me.other_hash[ data[i].get('ObjectID')] = Ext.Object.merge(me.other_hash[ data[i].get('ObjectID')], data[i].data );
                        }
                    }
                    start_index = start_index + gap;
                    if ( start_index < other_id_array.length ) {
                        me._doNestedOtherArray( type, rows, other_id_array, start_index );
                    } else {
                        me._populateRowData(type,rows);
                    }
                }
            }
        });
    },
    _addToTimeboxFilter: function( query, value ) {
        var single_query = Ext.create('Rally.data.QueryFilter', {
           property: 'ObjectID',
           operator: '=',
           value: value
        });
        if ( ! query ) {
            query = single_query;
        } else {
            query = query.or( single_query );
        }
        
        return query;
    },
    _populateRowData: function( type, rows ) {
        this.log( "_populateRowData: " + type );
        var item_length = rows.length;
        for ( var i=0; i<item_length; i++ ) {
            var item = rows[i];
            if (( item.iteration !== "" ) && ( this.timebox_hash[item.iteration] )) {
                item.iteration_date = this.timebox_hash[item.iteration].EndDate;
            }
            if (( item.release !== "" ) && ( this.timebox_hash[item.release] )) {
                item.release_date = this.timebox_hash[item.release].EndDate;
            }
            if (( item.project ) && (this.project_hash[item.project])) {
                this.log( this.project_hash[item.project] );
                item.project = this.project_hash[item.project].Name;
            } else { 
                item.project = "Unknown " + item.project;
            }
            
            if ( ( this.our_hash[ item.object_id ] ) && ( this.our_hash[item.object_id].children )) {
                var total_kids = this.our_hash[item.object_id].children.length;
                var scheduled_kids = this.our_hash[item.object_id].scheduled_children.length;
                item.epic = true;
                item.epic_report = scheduled_kids + " of " + total_kids;
            }
            
            
            
            if ((item.other_id) && (this.other_hash[item.other_id])) {
                var other = this.other_hash[item.other_id];
                item.other_name = other.Name;
                item.other_schedule_state = other.ScheduleState;
            
                if ( other.children ) {
                    var total_kids = other.children.length;
	                var scheduled_kids = other.scheduled_children.length;
	                item.other_epic = true;
	                item.other_epic_report = scheduled_kids + " of " + total_kids;
                }
                
	            if (( other.Iteration ) && ( this.timebox_hash[other.Iteration] )) {
	                item.other_iteration_date = this.timebox_hash[other.Iteration].EndDate;
	            }
	            if (( other.Release ) && ( this.timebox_hash[other.Release] )) {
	                item.other_release_date = this.timebox_hash[other.Release].EndDate;
	            }
            }
        }
        this._makeTable( type, rows );
    },
    _makeTable:function( type, rows ) {
        var me = this;
        me.log( "_makeTable: " + type);
        var cols = [
                { id: 'direction', label: 'Your Team...', type: 'string' },
                { id: 'project', label: 'Team', type: 'string' },
                { id: 'epic_report', label: 'Epic', type: 'string' },
                { id: 'name', label: 'Our Story', type: 'string' },
                { id: 'schedule_state', label: 'State', type: 'string' },
                { id: 'release_date', label: 'Release Date', type: 'date' },
                { id: 'iteration_date', label: 'Iteration Date', type: 'date' },
                { id: 'other_project', label: 'Other Team', type: 'string' },
                { id: 'other_epic_report', label: 'Epic', type: 'string' },
                { id: 'other_name', label: 'Their Story', type: 'string' },
                { id: 'other_schedule_state', label: 'State', type: 'string' },
                { id: 'other_release_date', label: 'Release Date', type: 'date' },
                { id: 'other_iteration_date', label: 'Iteration Date', type: 'date' },
                { id: 'tags', label: 'Tags', type: 'string' }
            ];
        var data_table = new google.visualization.DataTable({
            cols: cols
        });
        // google table is scary because row is pushed as an array of column values
        // that have to be matched to the cols array above (would be nice to have key indexing)
        var number_of_rows = rows.length;
        for ( var i=0; i<number_of_rows; i++ ) {
            var table_row = [];
            Ext.Array.each( cols, function(column) {
                table_row.push( rows[i][column.id] );
            });
            data_table.addRow(table_row);
        }
        
        var view = new google.visualization.DataView(data_table);
        var outer_box_id = type + '_box';
        
        if ( me.down('#' + outer_box_id ) ) { me.down('#'+outer_box_id).destroy(); }
        if ( type === "Successors" ) {
            me.down('#table_box').add( { xtype: 'container', html: "<h1>Your team delivering stories to other teams</h1>" } );
        } else {
            me.down('#table_box').add( { xtype: 'container', html: "<h1>Your team receiving stories from other teams</h1>" } );
        }
        me.down('#table_box').add( { xtype: 'container', itemId: outer_box_id, id: outer_box_id } );
        
        var table = new google.visualization.Table( document.getElementById(outer_box_id) );
        table.draw( view, { showRowNumber: false, allowHtml: true } );
    }
});
