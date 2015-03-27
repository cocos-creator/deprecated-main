// NOTE: there are two way to initialize a panel,
// panel:ready happends when a panel open in a new window
// panel:open happends when a panel open in a exists window

Fire.sendRequestToCore( 'panel:ready', Fire.argv.panelID,
                        function ( detail ) {
    var panelID = detail['panel-id'];
    var panelInfo = detail['panel-info'];
    var packagePath = detail['package-path'];
    var argv = detail.argv;

    var Path = require('fire-path');
    Fire.PanelMng.load( Path.join( packagePath, panelInfo.view ),
                        panelID,
                        panelInfo,
                        function ( err, element ) {
                            element.argv = argv;

                            if ( panelInfo.type === 'dockable' ) {
                                var dock = new FireDock();
                                dock.setAttribute('fit', '');
                                dock.setAttribute('no-collapse', '');

                                var panel = new FirePanel();
                                if ( panelInfo.width )
                                    panel.width = panelInfo.width;

                                if ( panelInfo.height )
                                    panel.height = panelInfo.height;

                                if ( panelInfo['min-width'] )
                                    panel['min-width'] = panelInfo['min-width'];

                                if ( panelInfo['min-height'] )
                                    panel['min-height'] = panelInfo['min-height'];

                                if ( panelInfo['max-width'] )
                                    panel['max-width'] = panelInfo['max-width'];

                                if ( panelInfo['max-height'] )
                                    panel['max-height'] = panelInfo['max-height'];

                                panel.add(element);
                                dock.appendChild(panel);
                                document.body.appendChild(dock);

                                Fire.PanelMng.root = dock;
                            }
                            else {
                                document.body.appendChild(element);

                                Fire.PanelMng.root = element;
                            }

                            // save layout after css layouted
                            window.requestAnimationFrame ( function () {
                                Fire.sendToCore( 'window:save-layout',
                                                Fire.PanelMng.getLayout(),
                                                Fire.RequireIpcEvent );
                            });
                        } );
} );
