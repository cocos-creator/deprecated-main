//
try {
    Pace.once( 'hide', function () {
        var launchPage = document.getElementById('launch-page');
        launchPage.remove();
    });

    // init document events
    document.addEventListener( "dragstart", function (event) {
        event.preventDefault(); 
    } );
    document.addEventListener( "drop", function (event) {
        event.preventDefault(); 
    } );
    document.addEventListener( "dragover", function (event) {
        event.preventDefault(); 
    } );
    document.addEventListener( "contextmenu", function (event) {
        event.preventDefault();
        event.stopPropagation();
    } );

    window.onload = function () {
        // NOTE: this will prevent mac touchpad scroll the body
        document.body.onscroll = function ( event ) {
            document.body.scrollLeft = 0;
            document.body.scrollTop = 0;
        };
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
