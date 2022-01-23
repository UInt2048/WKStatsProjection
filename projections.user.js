// ==UserScript==
// @name         WKStats Projections Page
// @version      1.2.3
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

    let maxLevel = null, progressions = [], stats = null, now = null;

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

    const countRadical = function(radicalLevel, kanjiLevel) {
        // For kanji in future levels, don't count passing time for radicals on preceding levels
        return !(kanjiLevel > progressions[progressions.length - 1].level && radicalLevel < kanjiLevel);
    };

    const levelDuration = function(level) {
        return new Date(level.passed_at || level.abandoned_at).subtractDate(new Date(level.unlocked_at));
    }

    const getLater = function(a, b) {
        return new Date(Math.max(a, b));
    }

    Date.prototype.add = function(seconds) {
        return this.setTime(this.getTime() + (seconds*1000)) && this;
    }
    Date.prototype.subtractDate = function(date) {
        return (this.getTime() - date.getTime()) / 1000;
    }
    Date.prototype.format = function() {
        return new window.Intl.DateTimeFormat([], { dateStyle: "medium", timeStyle: "medium" }).format(this);
    }

    const project = function project() {
        const current = progressions[progressions.length - 1];
        const levels = progressions.slice().concat(Array.from({length: maxLevel - current.level},
                                                              (_, i) => ({level: current.level + 1 + i})));
        const medianSpeed = median(progressions.slice(0, -1).map(levelDuration).sort((a, b) => a - b));
        const hypotheticalSpeed = (document.getElementById("speed")?.value || 240) * 3600;
        const hidePast = document.URL.includes("#hidePast");
        const time = stats.map(d => d.length && d.sort((a, b) => a[0] - b[0])[Math.ceil(d.length * 0.9) - 1][0]);
        const expanded = levels.slice().reverse().find(p => parseInt(document.URL.split("#L")[1]) === p.level);

        let output = `<label for="speed">Hypothetical Speed (in hours):</label>
            <input type="number" id="speed" value="${hypotheticalSpeed / 3600}"><span id="buttons">
            <button id="project">Project</button><br/>
            <button id="past">Toggle Past Levels</button><br/>
            <label for="speed">Show Details for Level:</label>
            <input type="number" id="expanded" value="${expanded?.level || current.level}">
            <button id="detailed">Show Details</button><br/>
            </span><table class="coverage"><tbody><tr class="header"> ${expanded ?
            "<td>Kanji</td><td colspan=3>Fastest</td>" :
        "<td>Level </td><td> Real/Predicted </td><td> Fastest </td><td> Hypothetical</td>"}</tr>`,
            unlocked = new Date(now), real = null, fastest = null, given = null, currentReached = false, info = "";

        for (const level of levels) {
            if (level === current) currentReached = true;
            if (hidePast && !currentReached) continue;

            if (level.unlocked_at) {
                unlocked = new Date(level.unlocked_at);
                info = `<td> ${unlocked.format()} </td><td> - </td><td> - </td>`;
            } else {
                fastest = (fastest || new Date(now)).add(time[level.level - 1]);
                real = getLater((real || new Date(unlocked)).add(medianSpeed), fastest);
                given = getLater((given || new Date(unlocked)).add(hypotheticalSpeed), fastest);
                info = `<td> ${real.format()} </td><td> ${fastest.format()} </td><td> ${given.format()} </td>`;
            }

            if (!expanded) {
                output += `<tr ${level === current ?
                    "class=\"current_level\"" : ""}><td> ${String("0" + level.level).slice(-2)} </td> ${info} </tr>`;
            } else if (expanded === level) {
                for (const kanji of stats[expanded.level]) {
                    const date = (kanji[0] < 0 ? "Passed on " : "") + (new Date(fastest || now)).add(kanji[0]).format();
                    output += `<tr><td>${kanji[1].data.characters}</td><td colspan=3>${date}</tr>`;
                }
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
        if (progressions.length > 0) return project();

        maxLevel = userData.subscription.max_level_granted;
        progressions = Object.values(levels).map(level => level.data);
        now = new Date();

        const passTime = function(item) {
            if (!item.assignments || !item.assignments.passed_at) {
                let interval = item.assignments?.available_at ?
                    Math.max(0, (new Date(item.assignments.available_at)).subtractDate(now)) : 0;
                const srs = systems[item.data.spaced_repetition_system_id].data;
                for (let stage = (item.assignments?.srs_stage || 0) + 1; stage < srs.passing_stage_position; stage++) {
                    interval += srs.stages[stage].interval;
                }
                return interval;
            }
            return (new Date(item.assignments.passed_at)).subtractDate(now);
        };

        stats = Array.from(Array(maxLevel + 1), () => []);
        for (const item of items) {
            if (item.data.hidden_at || item.object !== "kanji") continue;
            stats[item.data.level].push([item.data.component_subject_ids.map(id => {
                const radical = items.find(o => o.id === id);
                return countRadical(radical.data.level, item.data.level) ? Math.max(0, passTime(radical)) : 0;
            }).reduce((a, b) => Math.max(a, b)) + passTime(item), item]);
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
