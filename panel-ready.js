if ( Editor.argv.panelID ) {
    Editor.Panel.load( Editor.argv.panelID, function ( err, viewEL, panelInfo ) {
        if ( panelInfo.type === 'dockable' ) {
            var dock = new FireDock();
            dock.setAttribute('fit', '');
            dock.setAttribute('no-collapse', '');

            var panel = new FirePanel();
            panel.add(viewEL);
            dock.appendChild(panel);
            document.body.appendChild(dock);

            EditorUI.DockUtils.root = dock;
        }
        else {
            document.body.appendChild(viewEL);

            EditorUI.DockUtils.root = viewEL;
        }
        EditorUI.DockUtils.reset();

        Editor.sendToCore('panel:ready', Editor.argv.panelID);

        // save layout after css layouted
        window.requestAnimationFrame ( function () {
            Editor.sendToCore( 'window:save-layout',
                              Editor.Panel.getLayout(),
                              Editor.requireIpcEvent );
        });
    });
}
