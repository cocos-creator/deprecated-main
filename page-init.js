﻿//
try {
    // init document events

    // prevent default drag
    document.addEventListener( 'dragstart', function (event) {
        event.preventDefault();
    } );
    document.addEventListener( 'drop', function (event) {
        event.preventDefault();
    } );
    document.addEventListener( 'dragover', function (event) {
        event.preventDefault();
    } );

    // prevent contextmenu
    document.addEventListener( 'contextmenu', function (event) {
        event.preventDefault();
        event.stopPropagation();
    } );

    // prevent go back
    document.addEventListener( 'keydown', function (event) {
        if ( event.keyCode === 8 ) {
            if ( event.target === document.body ) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
    } );

    window.onload = function () {
        // NOTE: this will prevent mac touchpad scroll the body
        document.body.onscroll = function ( event ) {
            document.body.scrollLeft = 0;
            document.body.scrollTop = 0;
        };
    };

    // DISABLE: I disable this because developer may debug during initialize,
    //          and when he refresh at that time, the layout will be saved and
    //          reloaded layout will not be the expected one
    // window.onunload = function () {
    //     if ( Editor && Editor.Panel ) {
    //         // NOTE: do not use Editor.saveLayout() which will be invoked in requestAnimationFrame.
    //         // It will not be called in window.onunload
    //         Editor.sendToCore( 'window:save-layout',
    //                            Editor.Panel.dumpLayout(),
    //                            Editor.requireIpcEvent );
    //     }
    //     else {
    //         Editor.sendToCore( 'window:save-layout',
    //                            null,
    //                            Editor.requireIpcEvent );
    //     }
    // };

    window.onerror = function ( message, filename, lineno, colno, error ) {
        if ( Editor && Editor.sendToWindows ) {
            Editor.sendToWindows('console:error', error.stack || error);
        }
        else {
            console.error(message, error);
        }

        // Just let default handler run.
        return false;
    };
}
catch ( error ) {
    window.onload = function () {
        var remote = require('remote');
        var currentWindow = remote.getCurrentWindow();
        currentWindow.setSize(800, 600);
        currentWindow.center();
        currentWindow.show();
        currentWindow.openDevTools();
        console.error(error.stack || error);
    };
}
