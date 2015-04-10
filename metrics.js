/**
 *
 * Created by nantas on 15/3/25.
 */
var startTime;
var Editor = Editor || {};
Editor.Metrics = {
    //mixpanel event
    trackDashboardOpen: function() {
        if (analytics)
            analytics.track("Dashboard Open");
    },
    trackEditorOpen: function() {
        startTime = new Date();
        if (analytics)
            analytics.track("Editor Open");
    },
    trackEditorClose: function() {
        var duration = (new Date() - startTime)*1000/60; //calculate minutes
        if (analytics)
            analytics.track("Editor Close", {
                "Duration In Minutes": duration
            });
    },
    trackCreateNewScene: function() {
        if (analytics)
            analytics.track("Create New Scene");
    },
    trackOpenScene: function() {
        if (analytics)
            analytics.track("Open Scene");
    },
    trackPlayInEditor: function() {
        if (analytics)
            analytics.track("Play In Editor");
    },
    trackBuild: function(target) {
        if (analytics)
            analytics.track("Build", {
                "Target Platform": target
            });
    },
    trackOpenCodeEditor: function() {
        if (analytics)
            analytics.track("Open Code Editor");
    }
    //trackEditorCrash:
};
