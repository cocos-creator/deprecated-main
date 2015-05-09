if ( Editor.argv.panelID ) {
    Editor.Panel.load( Editor.argv.panelID, function ( err, frameEL, panelInfo ) {
        if ( err ) {
            return;
        }

        if ( panelInfo.type === 'dockable' ) {
            var dock = new FireDock();
            dock.setAttribute('no-collapse', '');
            dock.setAttribute('fit', '');

            var panelEL = new FirePanel();
            panelEL.add(frameEL);

            dock.appendChild(panelEL);
            document.body.appendChild(dock);

            EditorUI.DockUtils.root = dock;
        }
        else {
            document.body.appendChild(frameEL);

            EditorUI.DockUtils.root = frameEL;
        }
        EditorUI.DockUtils.reset();

        Editor.sendToCore('panel:ready', Editor.argv.panelID);

        // save layout after css layouted
        Editor.saveLayout();
    });
}
