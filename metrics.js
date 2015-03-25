/**
 *
 * Created by nantas on 15/3/25.
 */
var startTime;

var Fire = Fire || {};
Fire.Metrics = {
    //mixpanel event
    trackDashboardOpen: function() {
        if (mixpanel)
            mixpanel.track("Dashboard Open");
    },
    trackEditorOpen: function() {
        startTime = new Date();
        if (mixpanel)
            mixpanel.track("Editor Open");
    },
    trackEditorClose: function() {
        var duration = (new Date() - startTime)*1000/60; //calculate minutes
        if (mixpanel)
            mixpanel.track("Editor Close", {
                "Duration In Minutes": duration
            });
    },
    trackCreateNewScene: function() {
        if (mixpanel)
            mixpanel.track("Create New Scene");
    },
    trackOpenScene: function() {
        if (mixpanel)
            mixpanel.track("Open Scene");
    },
    trackPlayInEditor: function() {
        if (mixpanel)
            mixpanel.track("Play In Editor");
    },
    trackBuild: function(target) {
        if (mixpanel)
            mixpanel.track("Build", {
                "Target Platform": target
            });
    },
    trackOpenCodeEditor: function() {
        if (mixpanel)
            mixpanel.track("Open Code Editor");
    }
    //trackEditorCrash:
};
