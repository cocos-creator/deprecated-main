// NOTE: there are two way to initialize a panel,
// panel:query-info happends when a panel open in a new window
// panel:open happends when a panel open in a exists window

Fire.sendRequestToCore( 'panel:query-info', Fire.argv.panelID,
                        function ( results ) {
    var panelInfo = results.panelInfo;
    var packagePath = results.packagePath;
    var argv = results.argv;

    var Path = require('fire-path');
    Fire.PanelMng.load( Path.join( packagePath, panelInfo.view ),
                        Fire.argv.panelID,
                        panelInfo,
                        function ( err, element ) {
                            if ( panelInfo.type === "dockable" ) {
                                var dock = new FireDock();
                                dock.setAttribute('fit', '');
                                dock.setAttribute('no-collapse', '');

                                var panel = new FirePanel();

                                panel.add(element);
                                dock.appendChild(panel);
                                document.body.appendChild(dock);
                            }
                            else {
                                document.body.appendChild(element);
                            }
                        } );
} );

var Ipc = require('ipc');
Ipc.on( 'panel:open', function ( results ) {
    var panelID = results.panelID;
    var panelInfo = results.panelInfo;
    var path = results.packagePath;
    var argv = results.argv;

    // TODO:
});
