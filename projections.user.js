// ==UserScript==
// @name         WKStats Projections Page
// @version      1.3.4
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
    };

    const median = function median(arr) {
        const mid = Math.floor(arr.length / 2);
        return arr.length === 0 ? 0 : arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    const countComponent = function(componentLevel, itemLevel) {
        // For items in future levels, don't count passing time for components on preceding levels
        return !(itemLevel > progressions[progressions.length - 1].level && componentLevel < itemLevel);
    };

    const levelDuration = function(level) {
        return new Date(level.passed_at || level.abandoned_at).subtractDate(new Date(level.unlocked_at));
    };

    const getLater = function(a, b) {
        return new Date(Math.max(a, b));
    };

    const getFools = function(date) {
        return new Date(date.getFullYear() + (date.getMonth() >= 3), 3, 1);
    };

    const get = function(a, b) {
        return a && a[b];
    };

    const getID = function(a, b) {
        return get(document.getElementById(a), b);
    };

    const getHypothetical = function(fastest, isCurrent) {
        const s = isCurrent ? "current" : fastest;
        return getID("speed" + (getID("hypothetical", "checked") ? "-" + s : ""), "value") * 3600 || 864000;
    }

    const formatInterval = function(seconds) {
        const days = seconds / 86400;
        const hours = (days % 1) * 24;
        const minutes = (hours % 1) * 60;
        const secs = (minutes % 1) * 60;
        return `${Math.floor(days)}d ${Math.floor(hours)}h ${Math.floor(minutes)}m ${Math.floor(secs)}s`;
    };

    const findLevel = function(levels, level) {
        return levels.slice().reverse().find(p => level == p.level);
    };

    const rangeFormat = function(arr) {
        return arr.map((n, i) => i < arr.length - 1 && arr[i + 1] - n === 1 ?
                       `${i > 0 && n - arr[i - 1] === 1 ? "" : n}-` : `${n}, `
        ).join("").replace(/-+/g, "-").slice(0, -2);
    }

    Date.prototype.add = function(seconds) {
        return this.setTime(this.getTime() + (seconds*1000)) && this;
    };

    Date.prototype.subtractDate = function(date) {
        return (this.getTime() - date.getTime()) / 1000;
    };

    Date.prototype.format = function() {
        return new window.Intl.DateTimeFormat("default", {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric'}).format(this);
    };

    const project = function project() {
        const current = progressions[progressions.length - 1];
        const levels = progressions.slice().concat(Array.from({length: maxLevel - current.level + 2},
                                                              (_, i) => ({level: current.level + 1 + i})));
        const medianSpeed = median(progressions.slice(0, -1).map(levelDuration).sort((a, b) => a - b));
        const hidePast = getID("hidePast", "checked");
        const fools = getID("fools", "checked");
        const hypothetical = getID("hypothetical", "checked");
        const time = stats.map(d => d.length && d.sort((a, b) => a[0] - b[0])[Math.ceil(d.length * 0.9) - 1][0]);
        const expanded = getID("expand", "checked") && findLevel(levels, getID("expanded", "value"));
        const u = time.map((d, i) => {
            const unlocked = get(findLevel(levels, i), "unlocked_at");
            return [(unlocked ? now.subtractDate(new Date(unlocked)) : 0) + d, i];
        });

        let output = `<input type="checkbox" id="expand" class="project" ${expanded ? "checked" : ""}>
            <label for="speed">Show Details for Level:</label>
            <input type="number" id="expanded" size="3" value="${get(expanded, "level") || current.level}"><br/>
            <input type="checkbox" id="hidePast" class="project" ${hidePast ? "checked" : ""}>
            <label for="hidePast">Hide Past Levels</label><br/>
            <input type="checkbox" id="fools" class="project" ${fools ? "checked" : ""}>
            <label for="fools">Dark Blockchain</label><br/>
            <input type="checkbox" id="hypothetical" class="project" ${hypothetical ? "checked" : ""}>
            <label for="hypothetical">Expand Hypothetical</label><br/>
            ${hypothetical ? Array.from(new Set(u.slice(current.level, -1).map(d => d[0]))).map((time, i) => {
                const s = i === 0 ? "current" : time;
                return `<label for="speed-${s}">Hypothetical Speed for fastest ${formatInterval(time)}
                (levels ${rangeFormat(u.filter((d, i) => time === d[0]).map(d => d[1]))}):</label>
                <input type="number" id="speed-${s}" size="4" value="${getHypothetical(time, i === 0) / 3600}">h<br/>`;
            }).reduce((a, b) => a + b) : `<label for="speed">Hypothetical Speed:</label>
            <input type="number" id="speed" size="4" value="${getHypothetical(time) / 3600}">h`}
            <button id="project" class="project">Project</button><br/>
            <table class="coverage"><tbody><tr class="header"> ${expanded ?
            "<td>Kanji</td><td colspan=3>Fastest</td>" :
        "<td>Level </td><td> Real/Predicted </td><td> Fastest </td><td> Hypothetical</td>"}</tr>`,
            unlocked = new Date(now), real = null, fastest = null, given = null, currentReached = false, info = "";

        for (const level of levels) {
            if (level === current) currentReached = true;
            if (hidePast && !currentReached) continue;

            if (level.unlocked_at) {
                unlocked = new Date(level.unlocked_at);
                info = `<td> ${unlocked.format()} </td><td> - </td><td> - </td>`;
            } else if (level.level <= maxLevel) {
                fastest = (fastest || new Date(now)).add(time[level.level - 1]);
                real = getLater((real || new Date(unlocked)).add(medianSpeed), fastest);
                given = getLater((given || new Date(unlocked)).add(getHypothetical(time[level.level - 1],
                                                                                   level.level === current.level + 1)),
                                 fastest);
                info = `<td> ${real.format()} </td><td> ${
                (fools ? getFools(fastest) : fastest).format()} </td><td> ${given.format()} </td>`;
            } else {
                const _fastest = (new Date(fastest) || new Date(now)).add(time[level.level - 1]);
                const _real = getLater((new Date(real) || new Date(unlocked)).
                                       add(level.level === maxLevel + 2 ? time[level.level - 1] : medianSpeed),
                                       _fastest);
                const _given = getLater((new Date(given) || new Date(unlocked)).
                                        add(level.level === maxLevel + 2 ? time[level.level - 1] :
                                            getHypothetical(time[level.level - 1], level.level === current.level + 1)),
                                        _fastest);
                info = `<td> ${_real.format()} </td><td> ${
                (fools ? getFools(_fastest) : _fastest).format()} </td><td> ${_given.format()} </td>`;
            }

            if (!expanded) {
                output += `<tr ${level === current ? "class=\"current_level\"" : ""}><td> ${
                level.level === maxLevel + 2 ? "全火" : String("0" + level.level).slice(-2)} </td> ${info} </tr>`;
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
        Array.from(document.getElementsByClassName("project")).forEach(x => x.addEventListener("click", project));
        addGlobalStyle();
    };

    const api = function api(userData, levels, systems, items) {
        if (progressions.length > 0) return project();

        maxLevel = userData.subscription.max_level_granted;
        progressions = Object.values(levels).map(level => level.data);
        now = new Date();

        const time = function(item, burn) {
            if (!get(item.assignments, burn ? "burned_at" : "passed_at")) {
                let interval = get(item.assignments, "available_at") ?
                    Math.max(0, (new Date(item.assignments.available_at)).subtractDate(now)) : 0;
                const srs = systems[item.data.spaced_repetition_system_id].data;
                const target = get(srs, burn ? "burning_stage_position" : "passing_stage_position");
                for (let i = (get(item.assignments, "srs_stage") || 0) + 1; i < target; i++) {
                    interval += srs.stages[i].interval;
                }
                return interval;
            }
            return (new Date(get(item.assignments, burn ? "burned_at" : "passed_at"))).subtractDate(now);
        };

        const unlock = function(item, itemLevel, burn) {
            return countComponent(item.data.level, itemLevel) ?
                (item.object === "radical" ? 0 : item.data.component_subject_ids.
                 map(id => Math.max(0, unlock(items.find(o => o.id === id), item.data.level))).
                 reduce((a, b) => Math.max(a, b))) + time(item, burn) : 0;
        };

        stats = Array.from(Array(maxLevel + 1), () => []);
        for (const item of items) {
            if (item.data.hidden_at || item.object !== "kanji") continue;
            stats[item.data.level].push([unlock(item, item.data.level, false), item]);
        }

        let burnStats = items.filter(item => !item.data.hidden_at).map(item => unlock(item, item.data.level, true));
        stats.push([[burnStats.sort((a, b) => a - b)[burnStats.length - 1], burnStats]]);

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
