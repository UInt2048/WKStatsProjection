// ==UserScript==
// @name         WKStats Projections Page
// @version      1.2.1
// @description  Make a temporary projections page for WKStats
// @author       UInt2048
// @include      https://www.wkstats.com/*
// @run-at       document-end
// @grant        none
// @namespace https://greasyfork.org/users/684166
// ==/UserScript==

//jshint esversion:6
/*eslint max-len: ["error", { "code": 120 }]*/

(function() {
    "use strict";
    window.wkof.include("ItemData, Apiv2");

    let maxLevel = null, progression = [], current = null, stats = null, now = null;

    const addGlobalStyle = function addGlobalStyle() {
        const head = document.getElementsByTagName("head")[0], css = `
.main-content .chart table.coverage {margin-top:1em; position:relative;}
.main-content .chart table.coverage {border-collapse:collapse; border-spacing:0; margin-left:auto; margin-right:auto;}
.main-content .chart table.coverage tr {border-left:1px solid #000;}
.main-content .chart table.coverage tr:first-child {border-top:1px solid #000;}
.main-content .chart table.coverage tr:last-child {border-bottom:1px solid #000;}
.main-content .chart table.coverage tr.header {background-color:#ffd; font-weight:bold;}
.main-content .chart table.coverage tr.header:nth-child(2) {line-height:1em;}
.main-content .chart table.coverage tr.header.bottom {border-bottom:1px solid #000;}
.main-content .chart table.coverage tr:not(.header) + tr:not(.header):not(.current_level) {border-top:1px solid #ddd;}
.main-content .chart table.coverage tr:not(.header):nth-child(even) {background-color:#efe;}
.main-content .chart table.coverage td {padding:0 .5em;}
.main-content .chart table.coverage td:first-child {border-right:1px solid #000;}
.main-content .chart table.coverage td:last-child {border-right:1px solid #000;}
.main-content .chart table.coverage tr.header td.header_div {border-bottom:1px solid #0001;}
.main-content .chart table.coverage tr.count td {font-weight:normal; font-size:0.625em;}
.main-content .chart table.coverage tr.current_level {border:2px solid #000;}
.main-content .chart table.coverage tr.current_level:after
{content:"\f061"; font-family:FontAwesome; position:absolute; display:inline-block; left:-1.25em;}
        `;
        if (head) {
            const style = document.createElement("style");
            style.type = "text/css";
            style.innerHTML = css.replace(/;/g, " !important;");
            head.appendChild(style);
        }
    }

    const set = function set(url, item) {
        return () => {
            window.history.pushState({}, null, url + (document.getElementById(item)?.value ?? ""));
            project();
        };
    }

    const median = function median(arr) {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    }

    const levelDuration = function(lvl) {
        return new Date(lvl.passed_at ? lvl.passed_at : lvl.abandoned_at).subtractDate(new Date(lvl.unlocked_at));
    }

    Date.prototype.add = function(seconds) {
        this.setTime(this.getTime() + (seconds*1000));
        return this;
    }
    Date.prototype.subtractDate = function(date) {
        this.setTime(this.getTime() - date.getTime());
        return this.getTime() / 1000;
    }
    Date.prototype.format = function() {
        return new window.Intl.DateTimeFormat([], { dateStyle: "medium", timeStyle: "medium" }).format(this);
    }

    const project = function project() {
        const progressions = progression.slice();
        const levels = progressions.map($0 => $0.level);
        const medianSpeed = median(progressions.slice(0, -1).map(levelDuration).sort( ($0, $1) => $0 - $1));
        const hypotheticalSpeed = (document.getElementById("speed")?.value || 240) * 60 * 60;
        const hidePast = document.URL.includes("#hidePast");

        let time = [0];

        for (const data of stats.slice(1)) {
            time.push(data.sort(($0, $1) => $0[0] - $1[0])[Math.ceil(data.length * 0.9) - 1][0]);
        }

        if (levels[levels.length - 1] < maxLevel) {
            for (let i = levels[levels.length - 1] + 1; i <= maxLevel; i++) {
                levels.push(i);
                progressions.push({level: i});
            }
        }

        const expanded = parseInt(document.URL.includes("#L") && document.URL.split("#L")[1]);
        const expandedLevel = expanded && progressions.slice().reverse().find($0 => expanded == $0.level);

        let output = `<label for="speed">Hypothetical Speed (in hours):</label>
            <input type="number" id="speed" value="240"><span id="buttons"><button id="project">Project</button><br/>
            <button id="past">Toggle Past Levels</button><br/>
            <label for="speed">Show Details for Level:</label>
            <input type="number" id="expanded" value="${current.level}">
            <button id="detailed">Show Details</button><br/>
            </span><table class="coverage"><tbody><tr class="header"> ${expandedLevel ?
            "<td>Kanji</td><td colspan=3>Fastest</td>" :
        "<td>Level </td><td> Real/Predicted </td><td> Fastest </td><td> Hypothetical</td>"}</tr>`;

        let d = new Date(now), d1 = null, d2 = null, d3 = null, currentReached = false;
        for (const level of progressions) {
            let s = "";
            if (level === current) currentReached = true;
            if (hidePast && !currentReached) continue;

            if (level.unlocked_at) {
                d = new Date(level.unlocked_at);
                s += `<td> ${d.format()} </td><td> - </td><td> - </td>`;
            } else {
                if (d1 === null) {
                    d1 = new Date(d);
                    d2 = new Date();
                    d3 = new Date(d);
                }
                d1.add(medianSpeed);
                d2.add(time[level.level - 1]);
                d3.add(hypotheticalSpeed);

                // Ensure projections are not before fastest possible
                d1 = new Date(Math.max(d1, d2));
                d3 = new Date(Math.max(d3, d2));

                s += `<td> ${d1.format()} </td><td> ${d2.format()} </td><td> ${d3.format()} </td>`;
            }

            if (expandedLevel === level) {
                for (const kanji of stats[expanded]) {
                    const date = (kanji[0] < 0 ? "Passed on " : "") + (new Date(d2 || now)).add(kanji[0]).format();
                    output += `<tr><td>${kanji[1]}</td><td colspan=3>${date}</tr>`;
                }
            } else if (!expanded) {
                output += `<tr ${level === current ?
                    "class=\"current_level\"" : ""}><td> ${String("0" + level.level).slice(-2)} </td> ${s} </tr>`;
            }
        }

        output += "</tbody></table>";

        const element = document.getElementsByClassName("projections")[0];
        if (!element.className.includes("chart")) element.className += " chart";
        element.innerHTML = output;

        document.getElementById("project").onclick = project;
        document.getElementById("past").onclick = set(document.URL.includes("#hidePast") ? "#" : "#hidePast");
        document.getElementById("detailed").onclick = set("#L", "expanded");

        addGlobalStyle();
    }

    const api = function api(userData, levels, systems, items) {
        if (progression.length > 0) return project();

        maxLevel = userData.subscription.max_level_granted;
        for (const id in levels) {
            progression.push(levels[id].data);
        }
        current = progression[progression.length - 1];
        now = new Date();
        const getLength = function(item) {
            if (!item.assignments || !item.assignments.passed_at) {
                let interval = item.assignments && item.assignments.available_at ?
                    Math.max(0, (new Date(item.assignments.available_at)).subtractDate(now)) : 0;
                const system = systems[item.data.spaced_repetition_system_id];
                const passing = system.data.passing_stage_position;
                for (let stage = (item.assignments ? item.assignments.srs_stage : -1) + 1; stage < passing; stage++) {
                    interval += system.data.stages[stage].interval;
                }
                return interval;
            }
            return (new Date(item.assignments.passed_at)).subtractDate(now);
        };

        stats = Array.from(Array(maxLevel + 1), () => []);
        for (const item of items) {
            if (item.data.hidden_at || item.object !== "kanji") continue;
            const level = item.data.level;
            const radicals = item.data.component_subject_ids.map(id => {
                const radical = items.find(o => o.id === id);
                return radical.data.level === level ? getLength(radical) : 0;
            });
            const length = radicals.reduce((a, b) => Math.max(a, b)) + getLength(item);
            stats[item.data.level].push([length, item.data.characters]);
        }

        project();
    };

    window.wkof.ready("ItemData, Apiv2").then(() => {
        window.wkof.Apiv2.get_endpoint("user").then(userData => {
            window.wkof.Apiv2.get_endpoint("level_progressions").then(progressions => {
                window.wkof.Apiv2.get_endpoint("spaced_repetition_systems").then(systems => {
                    window.wkof.ItemData.get_items("subjects, assignments").then(items => {
                        // Enable callback when we enter the progression page
                        window.wkof.on("wkstats.projections.loaded", () => api(userData, progressions, systems, items));
                    });
                });
            });
        });
    });
})();
