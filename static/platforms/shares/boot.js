;window.onload = function () {
    function loadProjectSettings (callback) {
        Fire._TextLoader('settings.json', function (json, error) {
            if (error) {
                Fire.error(error);
            }
            else {
                callback(JSON.parse(json));
            }
        });
    }
    // init engine
    var canvas = document.getElementById('GameCanvas');
    Fire.Engine.init(canvas.width, canvas.height, canvas);
    // init assets
    Fire.AssetLibrary.init('resource/library');
    // load scene
    loadProjectSettings(function (project) {
        Fire.Engine.loadScene(project.scenes[0], function () {
            Fire.Engine.play();
        });
    });
};
