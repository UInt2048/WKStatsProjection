// ==UserScript==
// @name         WKStats Projections Page
// @version      1.0.0
// @description  Make a temporary projections page for WKStats
// @author       UInt2048
// @include      https://www.wkstats.com/progress/projections
// @run-at       document-end
// @grant        none
// @namespace https://greasyfork.org/users/684166
// ==/UserScript==

//jshint esversion:6

(function() {
    'use strict';
    window.wkof.include('ItemData, Apiv2');

    var user = null;
    var p = null;

    window.project = speed => {
        Date.prototype.add = function(seconds) {
            this.setTime(this.getTime() + (seconds*1000));
            return this;
        }
        Date.prototype.subtractDate = function(date) {
            this.setTime(this.getTime() - date.getTime());
            return this;
        }

        var progressions = [];
        for (var id in p) {
            progressions.push(p[id].data);
        }

        const maxLevel = user.subscription.max_level_granted;
        var levels = progressions.map($0 => $0.level);

        var levelDuration = (level => new Date(level.passed_at ? level.passed_at : level.abandoned_at).subtractDate(new Date(level.unlocked_at)).getTime());

        var sorted = progressions.slice(0, -1).sort( ($0, $1) => levelDuration($0) < levelDuration($1));

        const median = levelDuration(sorted[sorted.length / 2]) / 1000;

        // TODO: Use https://github.com/storyyeller/wkbuddy to dynamically obtain this list
        const fastLevels = [43, 44, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];

        const fastLevelFastest = (3 * 24 + 10) * 60 * 60;
        const slowLevelFastest = 2 * fastLevelFastest;
        const hypotheticalSpeed = (speed ? speed : 240) * 60 * 60;

        if (levels[levels.length - 1] < maxLevel) {
            for (var i = levels[levels.length - 1] + 1; i <= maxLevel; i++) {
                levels.push(i);
                progressions.push({level: i});
            }
        }

        const element = document.getElementsByClassName("projections")[0];

        var output = `<label for="speed">Hypothetical Speed (in hours):</label><input type="number" id="speed" value="240"> <button onclick="project(document.getElementById('speed').value);">Project</button>`;

        output += "<table><tr><td>Level </td><td> Real/Predicted </td><td> Fastest </td><td> Hypothetical</td></tr>";

        var d = new Date(), d1 = null, d2 = null, d3 = null;
        for (var level of progressions) {
            var s = "";

            if (level.unlocked_at) {
                d = new Date(level.unlocked_at);
                s += `<td> ${d} </td><td> - </td><td> - </td>`;
            } else {
                if (d1 === null) {
                    d1 = new Date(d);
                    d2 = new Date(d);
                    d3 = new Date(d);
                }
                d1.add(median);
                d2.add(fastLevels.includes(level.level) ? fastLevelFastest : slowLevelFastest);
                d3.add(hypotheticalSpeed);

                s += `<td> ${d1} </td><td> ${d2} </td><td> ${d3} </td>`;
            }

            output += `<tr><td> ${String("0" + level.level).slice(-2)} </td> ${s} </tr>`;
        }; // level progressions

        output += "</tbody></table>";
        element.innerHTML = output;
    }

    window.wkof.ready('ItemData, Apiv2').then(() => {
        window.wkof.Apiv2.get_endpoint('user').then(userData => {
            window.wkof.Apiv2.get_endpoint('level_progressions').then(progressions => {
                user = userData;
                p = progressions;
                window.project(null);
            });
        });
    });
})();
