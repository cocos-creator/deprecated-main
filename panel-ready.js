if ( Editor.argv.panelID ) {
    Editor.Panel.load( Editor.argv.panelID, function ( err, viewEL, panelInfo ) {
        if ( err ) {
            return;
        }

        if ( panelInfo.type === 'dockable' ) {
            var dock = new FireDock();
            dock.setAttribute('no-collapse', '');
            dock.setAttribute('fit', '');

            var panelEL = new FirePanel();
            panelEL.add(viewEL);

            dock.appendChild(panelEL);
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
        Editor.saveLayout();
    });
}
