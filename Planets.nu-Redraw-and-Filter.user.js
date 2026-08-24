// ==UserScript==
// @name        Planets.nu Redraw and Filter
// @author      Kero van Gelder
// @copyright   Kero van Gelder, 2015 - 2021
// @license     Lesser Gnu Public License, version 3
// @homepage    https://github.com/berapp
// @description For planets.nu -- More clarity on the map; allow to filter what is shown
// @namespace https://github.com/berapp
// @downloadURL https://github.com/berapp/Planets.nu-Redraw-and-Filter/edit/main/Planets.nu-Redraw-and-Filter.user.js
// @updateURL https://github.com/berapp/Planets.nu-Redraw-and-Filter/edit/main/Planets.nu-Redraw-and-Filter.user.js
// @include     http://planets.nu/*
// @include     https://planets.nu/*
// @include     http://*.planets.nu/*
// @include     https://*.planets.nu/*
// @require     https://chmeee.org/ext/planets.nu/McNimblesToolkit-1.2.6.user.js
// @version     2026.8.24.1
// @grant       none
// ==/UserScript==

var name = "Planets.nu Redraw and Filter";
var version = "2026.8.24.1";
var debug = true;

var deleteFromArray = function(array, element) {
    var index = array.indexOf(element);
    if (index >= 0) array.splice(index, 1);
}


function filterEverything() {
    if (vgap.settings.sphere && McN_Tk.haveSphereDuplication()) {
        // The drawing will happen as many times as needed. No need for duplicated objects
        redraw.ships = vgap.ships.filter(positiveId);
        redraw.planets = vgap.planets.filter(positiveId);
        redraw.minefields = vgap.minefields.filter(positiveId);
    } else {
        // No filtering
        redraw.ships = vgap.ships;
        redraw.planets = vgap.planets;
        redraw.minefields = vgap.minefields;
    }
}

var PodClansReallyAre = {};
PodClansReallyAre[204] = "nativeclans";
PodClansReallyAre[207] = "duranium";
PodClansReallyAre[208] = "tritanium";
PodClansReallyAre[209] = "molybdenum";
PodClansReallyAre[211] = "supplies";

function podClansAre(podHullId) {
    return PodClansReallyAre[podHullId] || "clans";
}

redraw = {
    shortRaceNames: {
        Humanoid: "Hum",
        Ghipsoldal: "Ghip",
        Amphibian: "Amph",
        Siliconoid: "Sil",
        Reptilian: "Rep",
        Insectoid: "Ins",
        Avian: "Av",
        Bovinoid: "Bov",
        Amorphous: "Amorph",
        Other: "(Natives)",
        none: "(Natives)"
    },

    nativeColors: {
        Humanoid: "#0088ff",
        Ghipsoldal: "#0088ff",
        Amphibian: "cyan",
        Siliconoid: "cyan",
        Reptilian: "#44ff44",
        Insectoid: "white",
        Avian: "white",
        Bovinoid: "yellow",
        Amorphous: "#ff4444",
        Other: "white",
        none: "white"
    },

    nativeColorsForHorwasp: {
        Humanoid: "cyan",
        Ghipsoldal: "#0088ff",
        Amphibian: "cyan",
        Siliconoid: "#ff4444",
        Reptilian: "#44ff44",
        Insectoid: "grey",
        Avian: "white",
        Bovinoid: "yellow",
        Amorphous: "cyan",
        Other: "white",
        none: "white"
    },

    ammoColors: [
        "#ffffff", // fighters
        "#888888", // m1 grey
        "#88ffff", // proton soft cyan
        "#ffff88", // m2 soft yellow
        "#88ff88", // gamma soft green
        "#ff88ff", // m3 soft magenta
        "#8888ff", // m4 soft blue
        "#ff8888", // m5 soft red
        "#00ff00", // m6 green
        "#0000ff", // m7 blue
        "#ff0000", // m8 red
        "#ffff00"  // Fed Quantum Torps, bright yellow
    ],

    MaxIncome: 5000,

    collectData: function() {
        redraw.resourceLocations = {};
        if (redraw.showShips) redraw.shipMapLocations = {};

        if (redraw.showPlanets) {
            redraw.planets.forEach(redraw.collectPlanetResources);
        }
        if (redraw.showStarbases) {
            vgap.starbases.forEach(redraw.collectStarbaseResources);
        }
        if (redraw.showShips) {
            redraw.ships.forEach(redraw.collectShipResources);
            redraw.ships.forEach(redraw.collectShipLocation);
            redraw.planets.forEach(redraw.collectPodsBeingBuiltResources);
        }
    },

    createLocation: function(x, y) {
        if (!redraw.resourceLocations[[x,y]]) {
            redraw.resourceLocations[[x,y]] = {x: x, y: y};
        }
        return redraw.resourceLocations[[x,y]];
    },

    collectPlanetResources: function(planet) {
        if (debug) console.log("collectPlanetResources");
        var ownerid = planet.ownerid;
        if (!redraw["showPlayer"+ownerid]) return;

        var location = redraw.createLocation(planet.x, planet.y);

        redraw.resources.forEach(function(resource) {
            if (resource == "Ammo") {
                // planet has no ammo
            } else if (resource == "Temp") {
                location.temp = planet.temp;
            } else if (resource == "Surface") {
                // Combined surface minerals (Duranium + Tritanium + Molybdenum)
                var amount = (planet.duranium || 0) + (planet.tritanium || 0) + (planet.molybdenum || 0);
                if (amount > 0) {
                    if (!location.surface) location.surface = 0;
                    location.surface += amount;
                }
            } else if (resource == "NotDevNatives" ||
                       resource == "NotDevNoNatives" ||
                       resource == "UnderDevNatives" ||
                       resource == "UnderDevNoNatives" ||
                       resource == "CanBuildStarbase") {
                // Planetary Management planet-list filters, as map overlays (owned planets only)
                if (planet.ownerid != vgap.player.id) {
                    // skip non-owned
                } else if (resource == "CanBuildStarbase") {
                    // pmviewcode 10: enough surface resources to build a starbase, and none present
                    if (vgap.getStarbase(planet.id) == null) {
                        var mcSup = (planet.megacredits || 0) + (planet.supplies || 0);
                        var canNormal =
                            mcSup >= 900 &&
                            (planet.duranium || 0) >= 120 &&
                            (planet.tritanium || 0) >= 402 &&
                            (planet.molybdenum || 0) >= 340;
                        var canDebris =
                            planet.debrisdisk > 0 &&
                            mcSup >= 480 &&
                            (planet.duranium || 0) >= 70 &&
                            (planet.tritanium || 0) >= 242 &&
                            (planet.molybdenum || 0) >= 160;
                        if (canNormal || canDebris) {
                            location.canbuildstarbase = mcSup;
                        }
                    }
                } else {
                    // Development filters share: significant known ground minerals
                    var groundTotal =
                        (planet.groundduranium || 0) +
                        (planet.groundtritanium || 0) +
                        (planet.groundmolybdenum || 0);
                    var groundKnown = planet.groundduranium >= 0;
                    if (groundKnown && groundTotal >= 2000) {
                        // pmviewcode 14: Not Developed with Natives
                        if (resource == "NotDevNatives" &&
                            ((planet.clans < 20) || (planet.mines < 20)) && planet.nativeclans > 0) {
                            location.notdevnatives = groundTotal;
                        }
                        // pmviewcode 13: Not Developed without Natives
                        if (resource == "NotDevNoNatives" &&
                            ((planet.clans < 20) || (planet.mines < 20)) && planet.nativeclans == 0) {
                            location.notdevnonatives = groundTotal;
                        }
                        // pmviewcode 12: Under Developed with Natives
                        if (resource == "UnderDevNatives" &&
                            ((planet.clans < 100) || (planet.mines < 100)) && planet.nativeclans > 0) {
                            location.underdevnatives = groundTotal;
                        }
                        // pmviewcode 11: Under Developed without Natives
                        if (resource == "UnderDevNoNatives" &&
                            ((planet.clans < 100) || (planet.mines < 100)) && planet.nativeclans == 0) {
                            location.underdevnonatives = groundTotal;
                        }
                    }
                }
            } else {
                var name = resource.toLowerCase();

                var addResource = function(amount) {
                    if (amount > 0) {
                        if (!location[name]) location[name] = 0;
                        location[name] += amount;
                    }
                }

                if (name == "clans" && planet.larva > 0) {
                    location.larva = planet.larva;
                }

                addResource(planet[name]);
            }
        })
    },

  collectStarbaseResources: function (starbase) {
      if (debug) console.log("collectStarbaseResources");
        var planet = vgap.getPlanet(starbase.planetid);
        var ownerid = planet.ownerid;
        if (!redraw["showPlayer"+ownerid]) return;

        // starbases have no coordinates until they are selected; use planet coords
        var location = redraw.createLocation(planet.x, planet.y);

        redraw.resources.forEach(function(resource) {
            if (resource == "Ammo") {
                if (starbase.fighters > 0) {
                    if (!location.ammo) location.ammo = [0];
                    if (!location.ammo[0]) location.ammo[0] = 0;
                    location.ammo[0] += starbase.fighters;
                }
                for (var torpId=1; torpId<=10; torpId++) {
                    var stock = vgap.getStock(starbase.id, 5, torpId);
                    if (stock) {
                        var torpsInStock = stock.amount;
                        if (torpsInStock > 0) {
                            if (!location.ammo) location.ammo = [];
                            if (!location.ammo[torpId]) location.ammo[torpId] = 0;
                            location.ammo[torpId] += torpsInStock;
                        }
                    }
                }
            } else {
                // starbase has neither temp nor resources
            }
        });
    },

  collectShipResources: function (ship) {
      if (debug) console.log("collectShipResources");
        var ownerid = ship.ownerid;
        if (!redraw["showPlayer"+ownerid]) return;

        if (redraw.isComputerPlayerShip(ship)) return;

        if (ship.x) {
            // When exiting "Replay Turn" before ships move, they have no coordinates in the (mistaken!) draw() from deselectAll()
            var location = redraw.createLocation(ship.x, ship.y);

            redraw.resources.forEach(function(resource) {
                if (resource == "Ammo") {
                    var index = ship.bays > 0 ? 0 : ship.torpedoid; // torpedoid == 1 means Mark 1
                    if (!location.ammo) location.ammo = [];
                    if (!location.ammo[index]) location.ammo[index] = 0;
                    location.ammo[index] += ship.ammo;
                } else if (resource == "Temp") {
                    // ships have no temp
                } else if (resource == "Surface") {
                    var amount = (ship.duranium || 0) + (ship.tritanium || 0) + (ship.molybdenum || 0)
                               + (ship.transferduranium || 0) + (ship.transfertritanium || 0) + (ship.transfermolybdenum || 0);
                    if (amount > 0) {
                        if (!location.surface) location.surface = 0;
                        location.surface += amount;
                    }
                } else {
                    var name = resource.toLowerCase();

                    var addResource = function(amount) {
                        if (amount > 0) {
                            if (!location[name]) location[name] = 0;
                            location[name] += amount;
                        }
                    }

                    if (redraw.isPod(ship)) {
                        if (podClansAre(ship.hullid) == name) {
                            addResource(ship.clans);
                        }
                    } else {
                        addResource(ship[name]);
                    }

                    addResource(ship["transfer" + name]);
                }
            });
        }
    },

    collectPodsBeingBuiltResources: function(planet) {
        if (planet.podhullid > 0) {  // Horwasp building ship
            var amount = planet.podcargo;
            if (amount > 0) {
                var location = redraw.createLocation(planet.x, planet.y);
                var name = podClansAre(planet.podhullid);
                // addResource, should be a method on a resource object
                if (!location[name]) location[name] = 0;
                location[name] += amount;
            }
        }
    },

    isPod: function(object) {
        return object.isShip && object.hullid >= 200 && object.hullid < 1000
    },

    unarmedPodIds: [
        202,
        204,
        206,
        207,
        208,
        209,
        211
    ],

    isUnarmedPod: function(object) {
        return object.isShip &&
            redraw.unarmedPodIds.indexOf(object.hullid) >= 0
    },

    isHive: function(object) {
        return object.isShip && object.hullid == 115;
    },

    // whether resource is given, but bogus; seems to happen with Computer Players
    isComputerPlayerShip: function(object) {
        if (!object.isShip) return false;
        if (object.ownerid == 0) return false;
        var objectAccount = vgap.players[object.ownerid-1].accountid;
        var viewerAccount = vgap.player.accountid;
        return objectAccount == 0 && objectAccount != viewerAccount;
    },

    collectShipLocation: function(ship) {
        if (!redraw.showShip(ship)) return;

        var x = ship.x;
        var y = ship.y;
        if (!redraw.shipMapLocations[[x,y]]) {
            redraw.shipMapLocations[[x,y]] = {x: x, y: y, owners: []};
        }
        var location = redraw.shipMapLocations[[x,y]];
        if (!location.owners[ship.ownerid]) location.owners[ship.ownerid] = [];
        var shipsByOwner = location.owners[ship.ownerid];
        if (!shipsByOwner[ship.hullid]) shipsByOwner[ship.hullid] = [];
        shipsByOwner[ship.hullid].push(ship.id);

        if (!location.shipIdsAndNames) location.shipIdsAndNames = [];
        location.shipIdsAndNames.push(ship);

        return location;
    },

    detailedInfo: function (loc, nextTurnLoc, nextTurnShips, resource) {
        if (debug) console.log("detailedInfo");
        var locIsEmpty = function(location) {
            return !location.planet && (!location.ships || location.ships.length == 0);
        }
        var total = 0,
            nextTurnTotal = 0;

        var getAmount = function(obj, res) {
            if (!obj) return 0;
            if (res === "surface") {
                return (obj.duranium || 0) + (obj.tritanium || 0) + (obj.molybdenum || 0)
                     + (obj.transferduranium || 0) + (obj.transfertritanium || 0) + (obj.transfermolybdenum || 0);
            }
            var amount = obj[res];
            // Planets can have "unknown" supplies (and similar), encoded as -1
            if (amount < 0) return 0;
            return amount || 0;
        };

        if (loc.planet) total = getAmount(loc.planet, resource);
        if (loc.ships) loc.ships.forEach(function(ship) {
            total += getAmount(ship, resource);
        });

        if (nextTurnLoc.planet) nextTurnTotal = getAmount(nextTurnLoc.planet, resource);
        if (nextTurnLoc.ships) nextTurnLoc.ships.forEach(function(ship) {
            nextTurnTotal += getAmount(ship, resource);
        });

        // For all objects, even those that move away, compute deltas
        var deltas = [];
        if (loc.planet && nextTurnLoc.planet) {
            var amount = getAmount(loc.planet, resource);
            var nextTurnAmount = getAmount(nextTurnLoc.planet, resource);
            var delta = nextTurnAmount - amount;
            if (delta != 0) deltas.push(delta);
        }
        if (loc.ships) loc.ships.forEach(function(ship) {
            var nextTurnShip = nextTurnShips[Math.abs(ship.id)];
            if (!nextTurnShip) return;
            var delta = getAmount(nextTurnShip, resource) - getAmount(ship, resource);
            if (delta != 0) deltas.push(delta);
        });

        var result = "";
        if (total > 0) result += total;
        var cumulative = total;
        deltas.forEach(function(delta) {
            result += delta > 0 ? "+" + delta : delta;
            cumulative += delta;
        });
        if (!locIsEmpty(nextTurnLoc) && cumulative != nextTurnTotal) result += "→" + nextTurnTotal;

        if (result.length == 0) return undefined;
        return result;
    },

    DefaultOffToggleColor: "grey",

    // Can you Jettison MC ?!?
    // Notes and old turn info are also "information about an object" and thus belong here
    // Furthermore, I am looking for displaying graphics in text, but notes and temp are text already!
    // aside: Display Voltage in a classical ion storm, in reddish when approaching 150 (see NU ion storms computation) and red/purple/etc.
    resources: [
        "Neutronium",
        "Duranium",
        "Tritanium",
        "Molybdenum",
        "Supplies",
        "Megacredits",
        "Clans",
        "Nativeclans",
        "Ammo",
        "Temp",
        "Surface",
        "Goldenrod",
        "NotDevNatives",
        "NotDevNoNatives",
        "UnderDevNatives",
        "UnderDevNoNatives",
        "CanBuildStarbase"
    ],

    resource2Color: {
        "Neutronium": "rgb(255, 128, 128)",
        "Duranium": "rgb(128, 255, 128)",
        "Tritanium": "rgb(128, 255, 255)",
        "Molybdenum": "rgb(128, 128, 255)",
        "Supplies": "rgb(255, 255, 128)",
        "Megacredits": "rgb(255, 255, 255)",
        "Clans": "rgb(255, 128, 255)",
        "Nativeclans": "rgb(200, 200, 200)",
        "Ammo": "rgb(255, 0, 0)",
        "Temp": "rgb(128, 64, 128)",
        "Surface": "lime",
        "Goldenrod": "rgb(218, 165, 32)",
        "NotDevNatives": "rgb(255, 140, 0)",
        "NotDevNoNatives": "rgb(255, 69, 0)",
        "UnderDevNatives": "rgb(255, 200, 50)",
        "UnderDevNoNatives": "rgb(218, 165, 32)",
        "CanBuildStarbase": "rgb(0, 191, 255)",
    },

    colorForResource: function(resource) {
        return redraw.resource2Color[resource];
    },

    players: function() {
        var ghostPlayers = [0];
        var playingPlayers = vgap.relations.map(function(relation) {
            return relation.playertoid;
        });
        return ghostPlayers.concat(playingPlayers);
    },

    filters: [
        "Planets",
        "Starbases",
        "Ships",
        "Waypoints",
        "Minefields",
        "Ionstorms",
        "Nebulas",
        "Infoturns"
    ],

    filter2Color: {
        "Planets": "white",
        "Starbases": "white",
        "Ships": "white",
        "Waypoints": "white",
        "Minefields": "white",
        "Ionstorms": "yellow",
        "Nebulas": "lightgreen",
        "Infoturns": "white"
    },

    filterDefault: function(filter) {
        if (filter.startsWith("Player")) return true;
        if (redraw.resources.indexOf(filter) >= 0) return false;
        if (filter === "Minefields") return redrawAndFilter.settings.showMinefields();
        if (filter === "Ships") return redrawAndFilter.settings.showShips();
        if (redraw.filters.indexOf(filter) >= 0) return true;

        console.log("Unknown filter", filter);
        return true;
    },

    colorForFilter: function(filter) {
        return redraw.filter2Color[filter];
    },

    listeners: {},

    initialize: function() {
        redraw.players().forEach(function(playerId) {
            var filter = "Player" + playerId;

            redraw.listeners[filter] = [];
            var showName = "show" + filter;
            redraw[showName] = redraw.filterDefault(filter);
            redraw["toggleShow"+filter] = function() {
                redraw[showName] = !redraw[showName];
                redraw.listeners[filter].forEach(function(changed) {
                    changed();
                });
                vgap.map.draw();
            };
        });

        redraw.filters.forEach(function(filter) {
            redraw.listeners[filter] = [];
            var showName = "show"+filter;
            redraw[showName] = redraw.filterDefault(filter);
            redraw["toggleShow"+filter] = function() {
                redraw[showName] = !redraw[showName];
                redraw.listeners[filter].forEach(function(changed) {
                    changed();
                });
                vgap.map.draw();
            };
        });

        redraw.resources.forEach(function(filter) {
            redraw.listeners[filter] = [];
            var showName = "show"+filter;
            redraw[showName] = redraw.filterDefault(filter);
            redraw["toggleShow"+filter] = function() {
                redraw[showName] = !redraw[showName];
                redraw.listeners[filter].forEach(function(changed) {
                    changed();
                });
                vgap.map.draw();
            };
        });
    },

    colorForPlanet: function(planet) {
        return redraw.showPlanet(planet) ? McN_Tk.colorForPlanet(planet) : McN_Tk.unownedPlanetColor;
    },

    showPlanet: function(planet) {
        return redraw.showPlanets && redraw["showPlayer"+planet.ownerid];
    },

    incomeForNativesForDropInHappiness: function(planet, happinessDrop) {
        if (planet.nativeclans > 0) {
            var race = this.raceForPlanet(planet);

            var avianBonus = planet.nativeracename == "Avian" ? 10 : 0;
            var clansPenalty = Math.sqrt(planet.nativeclans) / 100;
            var buildingsPenalty = (planet.mines + planet.factories) / 200;
            var government = planet.nativegovernment ? planet.nativegovernment : 5;
            var govPenalty = 0.5 * government;
            var taxRate = (10 + happinessDrop + avianBonus - clansPenalty - buildingsPenalty - govPenalty) / 85;
            if (race == 6) if (taxRate > 0.2) taxRate = 0.2;
            var income = planet.nativeclans * taxRate * (government/5.0) / 10;
            if (planet.nativeracename == "Insectoid") income *= 2;
            if (race == 1) income *= 2;
            if (race == 12) income = planet.nativeclans;
            if (income > this.MaxIncome) income = this.MaxIncome;
            if (race != 12 && planet.nativeracename == "Amorphous") income = 0;
            if (race == 12 && planet.nativeracename == "Siliconoid") income = 0;
            return income;
        }
        return 0;
    },

    raceForPlanet: function(planet) {
        return planet.ownerid > 0 ? vgap.players[planet.ownerid - 1].raceid : vgap.player.raceid;
    },

    showStarbase: function(base) {
        return redraw.showStarbaseFor(vgap.getPlanet(base.planetid));
    },

    showStarbaseFor: function(planet) {
        return redraw.showPlanets && redraw.showStarbases && redraw["showPlayer"+planet.ownerid];
    },

    showShip: function(ship) {
        return redraw.showShips && redraw["showPlayer"+ship.ownerid];
    },

    labelsFor: function(shipMapLocation) {
        var result = [];
        shipMapLocation.owners.forEach(function(ships, owner) {
            if (!ships) return;

            ships.forEach(function (ids, hullid) {
                if (!ids) return;

                var name = McN_Tk.shortHullName(vgap.getHull(hullid));
                result.push({owner: owner, text: ids.length + getOwnerLabel(owner) + " " + name});
            });
        });
        return result;
    },
};

var McN_Tk = vgap.plugins["McNimble's Toolkit"];

redrawAndFilter = new McN_Tk.McNimblesToolkit(name, version);

redrawAndFilter.model = redraw;

redrawAndFilter.settings.createFloatBrowserSetting("planetRadius", 3);
redrawAndFilter.settings.createGameSetting("showMinefields", 0.2);
redrawAndFilter.settings.createGameSetting("showShips", "hulltypes");

vgapMap.prototype.doNotCallDrawFromPlanetNames = false;

vgapMap.prototype.draw_wrappedByRedrawAndFilter = vgapMap.prototype.draw;
vgapMap.prototype.draw = function(fast, ctx, skipUserContent, secondCanvas) {
    vgap.map.doNotCallDrawFromPlanetNames = true;
    vgap.map.draw_wrappedByRedrawAndFilter(fast, ctx, skipUserContent, secondCanvas);
    vgap.map.doNotCallDrawFromPlanetNames = false;
};

// is called when pressing 'p' and from draw() via drawUserChangeable()
vgapMap.prototype.drawPlanetNames = function(x, y) {
    if (!vgap.map.doNotCallDrawFromPlanetNames) vgap.map.draw();
};

vgapMap.prototype.incZoom = function(delta) {
    if (vgap.map.zoom <= 0.2 && delta < 0)
        return;

    if (vgap.map.zoom >= 500 && delta > 0)
        return;

    var newZoom = delta > 0 ?
        vgap.map.zoom * 1.5 :
        vgap.map.zoom / 1.5;

    // NU moves from 100 to 60 and back, which is OK.
    if (newZoom > 0.89 && newZoom < 0.91) newZoom = 1;
    if (newZoom > 0.66 && newZoom < 0.67) newZoom = 0.6

    this.setZoom(parseFloat(newZoom.toFixed(1)));
}


var scale = 2;

var oldRenderConnections_wrappedByRedrawAndFilter = vgapMap.prototype.renderConnections;
vgapMap.prototype.renderConnections = function(ctx) {
    if (McN_Tk.onMobile()) {
        if (!vgap.connections) {
            // Would like to call GravConnect, but that code has no entry point
            // Also should be good to have 40-80 LY duplication, so NU actually will compute all your connections.
            // Method not available on desktop client :(
            vgap.buildConnections();
        }

        if (vgap.map.zoom >= 0.3) {
            vgap.connections.forEach(function(connection) {
                var pl1 = connection.a, pl2 = connection.b;
                McN_Tk.drawMapLine(pl1.x, pl1.y, pl2.x, pl2.y, "#666");
            });
        }
    } else {
        // just call NU
        oldRenderConnections_wrappedByRedrawAndFilter.apply(this, [vgap.map.ctx]);
    }
};

vgapMap.prototype.drawPlanet = function() {}

var drawPlanets = function(planets) {
    planets.forEach(drawPlanet);
};

var drawPlanet = function(planet) {
    var map = vgap.map;
    var model = redrawAndFilter.model;
    var style = model.colorForPlanet(planet);
    McN_Tk.drawMapDisc(planet.x, planet.y, redrawAndFilter.settings.planetRadius() / vgap.map.zoom, style);

    drawStarbaseInfo(planet);

    if (!map.showresources && map.zoom >= 0.5 && model.showPlanet(planet)) {
        model.resources.forEach(function(resource) {
            if (model["show"+resource]) {
                var inGround = planet["ground"+resource.toLowerCase()];
                if (inGround > 0) {
                    var radius = Math.sqrt(inGround) / scale;
                    var strokeStyle = "rgba"+redraw.colorForResource(resource).substring(3, redraw.colorForResource(resource).length-1) + ", 0.5)";
                    var density = planet["density"+resource.toLowerCase()];
                    var densityInTenths = density >= 0 ? density / 10.0 : 5;
                    McN_Tk.drawMapDashedCircle(planet.x, planet.y, radius, strokeStyle, densityInTenths);
                }
            }
        });
    }
};

var drawStarbaseInfo = function(planet) {
    var model = redrawAndFilter.model;
    if (model.showStarbaseFor(planet)) {
        var style = model.colorForPlanet(planet);
        if (planet.isbase) {
            McN_Tk.drawMapCrosshair(planet.x, planet.y, redrawAndFilter.starbaseRadius() / vgap.map.zoom, style);

            var starbase = vgap.getStarbase(planet.id);
            if (model.showStarbases == "builds" && starbase.isbuilding) {
                var order = "B: " + (hasBuildPrioFC(planet) ? planet.friendlycode+" " : "") + shipDescription(starbase.buildhullid, starbase.buildengineid, starbase.buildbeamcount, starbase.buildbeamid, starbase.buildtorpcount, starbase.buildtorpedoid);
                McN_Tk.drawNonoverlappingText(planet.x, planet.y, order, style);
            } else if (model.showStarbases == "defense") {
                var planetaryDefense = planet.defense >= 0 ? planet.defense : 0;  // planetary defense can be -1 for enemy, but not starbase defense

                var totalDefense = planetaryDefense + starbase.defense;
                if (starbase.starbasetype == 1) totalDefense += 200;  // SB in a star cluster

                var mass = 100 + totalDefense;
                var defense = "B: " + mass + "kt";

                var beams = Math.min(10, (Math.round(Math.sqrt(totalDefense / 3))));
                if (beams > 0) {
                    var beamId = Math.round(Math.sqrt(planetaryDefense / 2));
                    beamId = Math.min(10, beamId);
                    if (starbase.beamtechlevel > beamId) beamId = starbase.beamtechlevel;
                    if (beamId == 0) beamId = 1;
                    defense += " " + beams + McN_Tk.shortBeamName[beamId];
                }

                var fighters = Math.round(Math.sqrt(Math.max(0, planetaryDefense - 0.75)));  // what a strange formula. Seems the - 0.75 is not necessary at all
                if (starbase.fighters + fighters > 0) {
                    var bays = Math.floor(Math.sqrt(planetaryDefense)) + 5;
                    defense += " " + bays + "f/" + starbase.fighters + "+" + fighters;
                }

                McN_Tk.drawNonoverlappingText(planet.x, planet.y, defense, style);
            }
        } else if (planet.buildingstarbase) {
            McN_Tk.drawMapCrosshair(planet.x, planet.y, (redrawAndFilter.starbaseRadius()+1) / vgap.map.zoom, style, [2,2])
        }
    }
}

vgapMap.prototype.drawShip = function(ship) {};  // not called for ships around planets

var positiveId = function(obj) {
    return obj.id > 0;
};

redraw.oldDrawMinefield = vgapMap.prototype.drawMinefield;
vgapMap.prototype.drawMinefield = function() {
    if (!redraw.showMinefields) return;

    if (redraw.showMinefields === "nu") {
        redraw.oldDrawMinefield.apply(this, arguments);
    }
};

function drawMinefields() {
    if (typeof(redraw.showMinefields) === "number" || redraw.showMinefields === "details") {
        redraw.minefields.forEach(drawMinefield);
    }

    if (redraw.showMinefields === "nu" || typeof(redraw.showMinefields) === "number") {
        drawTinyMinefieldWarnings();
        drawOutdatedMinefieldWarnings();
    }
}

function drawMinefield(minefield) {
    var color = McN_Tk.colorForMinefield(minefield);
    McN_Tk.drawMapCircle(minefield.x, minefield.y, 1 / vgap.map.zoom, color);
    if (redraw.showMinefields === "details") {
        McN_Tk.drawMapCircle(minefield.x, minefield.y, minefield.radius, color);
        if (vgap.map.zoom > 1) {
            var label = (minefield.isweb ? "Web" : "Mf") + minefield.id + " " + minefield.units + "/" + minefield.radius + (minefield.infoturn != vgap.game.turn ? "T"+minefield.infoturn : "");
            McN_Tk.drawNonoverlappingText(minefield.x, minefield.y, label, color);
        }
    } else {  // showMinefields is a number(!)
        var fadedColor = colorToRGBA(color, redraw.showMinefields);
        McN_Tk.drawMapDisc(minefield.x, minefield.y, minefield.radius, fadedColor);
        if (minefield.isweb) McN_Tk.drawMapCircle(minefield.x, minefield.y, minefield.radius, color, 3*redraw.showMinefields);
    }
}

vgapMap.prototype.oldRedrawAndFilterDrawStar = vgapMap.prototype.drawStar;
vgapMap.prototype.drawStar = function(screenX, screenY, cluster, ctx) {
    this.oldRedrawAndFilterDrawStar(screenX, screenY, cluster, ctx);
    var width = 0.3;
    var color;
    if (cluster.temp <= 3000) color = "#ff0000";
    else if (cluster.temp <= 6000) color = "#ffa500";
    else if (cluster.temp <= 10000) color = "#ff4040";
    else if (cluster.temp <= 20000) color = "#ffffff";
    else color = "#b0e0e6";
    McN_Tk.drawSingleMapCircle(cluster.x, cluster.y, Math.sqrt(cluster.mass), color, width);
    // core radius + 10 is where minefields are destroyed
    McN_Tk.drawSingleMapCircle(cluster.x, cluster.y, cluster.radius+10, color, width);
};

vgapMap.prototype.oldRedrawAndFilterDrawDebris = vgapMap.prototype.drawDebris;
vgapMap.prototype.drawDebris = function(screenX, screenY, r, ctx) {
    this.oldRedrawAndFilterDrawDebris(screenX, screenY, r, ctx);
    var width = 0.2;
    McN_Tk.drawScreenCircle(screenX, screenY, r, "#ffff99", width);
};

var filter2Icon = {
    "Planets": {icon: "\uf0ac", fontClass: "fas"},
    "Starbases": {icon: "\uf50d", fontClass: "fab"},
    "Ships": {icon: "\uf197", fontClass: "fas"},
    "Waypoints": {icon: "\uf05b", fontClass: "fas"},
    "Minefields": {icon: "\uf0c2", fontClass: "fas"},
    "Ionstorms": {icon: "\uf0c2", fontClass: "fas"},
    "Nebulas": {icon: "\uf0c2", fontClass: "fas"},
    "Infoturns": {icon: "\uf66f", fontClass: "fas"}
};

var filter2Short = {
    "Planets": "Plan",
    "Starbases": "Base<span style='text: grey'>▼</span>",
    "Ships": "Sh<span style='text: grey'>▼</span>",
    "Waypoints": "Wayp",
    "Minefields": "Mf<span style='text: grey'>▼</span>",
    "Ionstorms": "Ion",
    "Nebulas": "Neb",
    "Infoturns": "Old"
};

var resource2Icon = {
    "Neutronium": {icon: "\uf06d", fontClass: "fas"},
    "Duranium": {icon: "\uf399", fontClass: "fab"},
    "Tritanium": {icon: "\uf037", fontClass: "fas fa-flip-vertical"},
    "Molybdenum": {icon: "\uf3cb", fontClass: "fab"},
    "Supplies": {icon: "\uf1b3", fontClass: "fas"},
    "Megacredits": {icon: "\uf155", fontClass: "fas"},
    "Clans": {icon: "\uf0c0", fontClass: "fas"},
    "Nativeclans": {icon: "\uf0c0", fontClass: "fas"},
    "Ammo": {icon: "\uf1d1", fontClass: "fab"},
    "Temp": {icon: "\uf2c9", fontClass: "fas"},
    "Surface": {icon: "\uf5fd", fontClass: "fas"},
    "Goldenrod": {icon: "\uf2c9", fontClass: "fas"},
    "NotDevNatives": {icon: "\uf06a", fontClass: "fas"},
    "NotDevNoNatives": {icon: "\uf057", fontClass: "fas"},
    "UnderDevNatives": {icon: "\uf071", fontClass: "fas"},
    "UnderDevNoNatives": {icon: "\uf12a", fontClass: "fas"},
    "CanBuildStarbase": {icon: "\uf015", fontClass: "fas"},
};

var resource2Short = {
    "Neutronium": "Neut",
    "Duranium": "Dur",
    "Tritanium": "Trit",
    "Molybdenum": "Mol",
    "Supplies": "Supp",
    "Megacredits": "MC",
    "Clans": "Col",
    "Nativeclans": "Nat",
    "Ammo": "Amm",
    "Temp": "Temp",
    "Surface": "Surf",
    "Goldenrod": "Gold",
    "NotDevNatives": "NDN",
    "NotDevNoNatives": "ND0",
    "UnderDevNatives": "UDN",
    "UnderDevNoNatives": "UD0",
    "CanBuildStarbase": "SBS",
};

redrawAndFilter.initialize = function() {
    this.model.initialize();

    // Players
    redraw.players().forEach(function(playerId) {
        redrawAndFilter["toggleShowPlayer"+playerId] = redraw["toggleShowPlayer"+playerId];
    });

    var playerToggles = redraw.players().map(function(playerId) {
        return {
            label: ""+playerId,
            name: "Player"+playerId,
            color: McN_Tk.colorForPlanetOwner(playerId),
            state: function() {
                return redraw["showPlayer"+playerId]
            },
            register: function(changed) {
                redraw.listeners["Player"+playerId].push(changed);
            },
            unregister: function(changed) {
                deleteFromArray(redraw.listeners["Player"+playerId], changed);
            },
            action: function() {
                redrawAndFilter["toggleShowPlayer"+playerId]();
            }
        };
    });

    McN_Tk.createMainMenuEntry({
        label:  "\uf0c0",
        fontClass: 'fas',
        name: "Player Filters",
        color: 'cyan',
        bg: 'darkblue',
        action: function() {
            McN_Tk.createMenu(playerToggles);
        }
    });

    // Filters aka Objects
    redraw.filters.map(function(filter) {
        redrawAndFilter["toggleShow"+filter] = redraw["toggleShow"+filter];
    });

    var objectToggles = redraw.filters.map(function(filter) {
        return {
            label: McN_Tk.onMobile() ? filter2Icon[filter].icon : filter2Short[filter],
            fontClass: filter2Icon[filter].fontClass,
            name: filter,
            color: redraw.colorForFilter(filter),
            state: function() {
                return redraw["show"+filter]
            },
            register: function(changed) {
                redraw.listeners[filter].push(changed);
            },
            unregister: function(changed) {
                deleteFromArray(redraw.listeners[filter], changed);
            },
            action: function() {
                redrawAndFilter["toggleShow"+filter]();
            }
        };
    });
    objectToggles[redraw.filters.indexOf("Ships")].action = function() {
        var toggles = showShipSettings.map(function(setting) {
            return {
                label: showShipSetting2Icon[setting.value],
                name: setting.description,
                state: function() {
                    return redraw.showShips === setting.value;
                },
                register: function(changed) {
                    redraw.listeners["Ships"].push(changed);
                },
                unregister: function(changed) {
                    deleteFromArray(redraw.listeners["Ships"], changed);
                },
                action: function() {
                    redraw.setShowShips(setting.value);
                }
            }
        });
        McN_Tk.createMenu(toggles);
    }
    objectToggles[redraw.filters.indexOf("Starbases")].action = function() {
        var toggles = showStarbaseSettings.map(function(setting) {
            return {
                label: showStarbaseSetting2Icon[setting.value],
                name: setting.description,
                state: function() {
                    return redraw.showStarbases === setting.value;
                },
                register: function(changed) {
                    redraw.listeners["Starbases"].push(changed);
                },
                unregister: function(changed) {
                    deleteFromArray(redraw.listeners["Starbases"], changed);
                },
                action: function() {
                    redraw.setShowStarbases(setting.value);
                }
            }
        });
        McN_Tk.createMenu(toggles);
    }
    objectToggles[redraw.filters.indexOf("Minefields")].action = function() {
        var toggles = showMinefieldSettings.map(function(setting) {
            return {
                label: showMinefieldSetting2Icon[setting.value],
                name: setting.description,
                state: function() {
                    return redraw.showMinefields === setting.value;
                },
                register: function(changed) {
                    redraw.listeners["Minefields"].push(changed);
                },
                unregister: function(changed) {
                    deleteFromArray(redraw.listeners["Minefields"], changed);
                },
                action: function() {
                    redraw.setShowMinefields(setting.value);
                }
            }
        });
        McN_Tk.createMenu(toggles);
    }

    McN_Tk.createMainMenuEntry({
        label: "\uf0b0",
        fontClass: 'fas',
        name: "Object Filters",
        color: 'cyan',
        bg: 'darkblue',
        action: function(){
            McN_Tk.createMenu(objectToggles);
        }
    });


    // Resources
    redraw.resources.map(function(resource) {
        redrawAndFilter["toggleShow"+resource] = redraw["toggleShow"+resource];
    });

    var resourceToggles = redraw.resources.map(function(resource) {
        return {
            label: McN_Tk.onMobile() ? resource2Icon[resource].icon : resource2Short[resource],
            fontClass: resource2Icon[resource].fontClass,
            name: resource,
            color: redraw.colorForResource(resource),
            state: function() {
                return redraw["show" + resource]
            },
            register: function(changed) {
                redraw.listeners[resource].push(changed);
            },
            unregister: function(changed) {
                deleteFromArray(redraw.listeners[resource], changed);
            },
            action: function() {
                redrawAndFilter["toggleShow"+resource]();
            }
        };
    });

    McN_Tk.createMainMenuEntry({
        label: "\uf1c0",
        fontClass: 'fas',
        name: "Resource Toggles",
        color: 'cyan',
        bg: 'darkblue',
        action: function() {
            McN_Tk.createMenu(resourceToggles);
        }
    });
};

var showShipSettings = [
    {description: "Hide", value: false},
    {description: "Only Ships", value: true},
    {description: "IDs and Names", value: "idsAndNames"},
    {description: "IDs and Equipment", value: "idsAndEquip"},
    {description: "Battle Information", value: "battleInfo"},
    {description: "Hull types", value: "hulltypes"}
];

var showStarbaseSettings = [
    {description: "Hide", value: false},
    {description: "Only Starbases", value: true},
    {description: "Build Order", value: "builds"},
    {description: "Defense", value: "defense"}
];

var showMinefieldSettings = [
    {description: "Hide", value: false},
    {description: "NU", value: "nu"},
    {description: "Player Colors (weak)", value: 0.15},
    {description: "Player Colors (M)", value: 0.2},
    {description: "Player Colors (bright)", value: 0.25},
    {description: "Details", value: "details"}
];

var showShipSetting2Icon = {
    false: "Ø",
    true: "Sh",
    "idsAndNames": "#Na",
    "idsAndEquip": "#Eq",
    "battleInfo": "BV",
    "hulltypes": "H"
}

var showStarbaseSetting2Icon = {
    false: "Ø",
    true: "Ba",
    "builds": "Bu",
    "defense": "Def"
}

var showMinefieldSetting2Icon = {
    false: "Ø",
    "nu": "NU",
    0.15: "Pl1",
    0.2: "Pl2",
    0.25: "Pl3",
    "details": "123"
}

redraw.setShowShips = function(value) {
    redraw.showShips = value;
    redrawAndFilter.settings.setShowShips(value);
    redraw.listeners["Ships"].forEach(function(changed) {
        changed()
    });
    vgap.map.draw();
};

redraw.nextShowShips = function() {
    var index;
    showShipSettings.forEach(function(setting, i) {
        if (setting.value === redraw.showShips) index = i;
    });
    var newIndex = (index + 1) % showShipSettings.length;
    var newSettings = showShipSettings[newIndex];
    redraw.setShowShips(newSettings.value);
}
// Created for Keyboard binding
redrawAndFilter.nextShowShips = redraw.nextShowShips;

redraw.setShowStarbases = function(value) {
    redraw.showStarbases = value;
    redraw.listeners["Starbases"].forEach(function(changed) {
        changed()
    });
    vgap.map.draw();
};

redraw.nextShowStarbases = function() {
    var index;
    showStarbaseSettings.forEach(function(setting, i) {
        if (setting.value === redraw.showStarbases) index = i;
    });
    var newIndex = (index + 1) % showStarbaseSettings.length;
    var newSettings = showStarbaseSettings[newIndex];
    redraw.setShowStarbases(newSettings.value);
}
// Created for Keyboard binding
redrawAndFilter.nextShowStarbases = redraw.nextShowStarbases;

redraw.setShowMinefields = function(value) {
    redraw.showMinefields = value;
    redrawAndFilter.settings.setShowMinefields(value);
    redraw.listeners["Minefields"].forEach(function(changed) {
        changed()
    });
    vgap.map.draw();
};

redraw.nextShowMinefields = function() {
    var index;
    showMinefieldSettings.forEach(function(setting, i) {
        if (setting.value === redraw.showMinefields) index = i;
    });
    var newIndex = (index + 1) % showMinefieldSettings.length;
    var newSettings = showMinefieldSettings[newIndex];
    redraw.setShowMinefields(newSettings.value);
}
// Created for Keyboard binding
redrawAndFilter.nextShowMinefields = redraw.nextShowMinefields;

// Belongs in Plugin.js
redrawAndFilter.draw = function() {
    if (redrawAndFilter.isInReplay) {
        // need some, but not all that is done for processload
        filterEverything();
        processIonstorms();
    }
    drawSphereBoundary();
    drawIonstorms();
    drawMinefields();

    drawPlanets(redraw.planets);

    redrawAndFilter.model.collectData();

    drawPlanetNames();
    drawPlanetInfoTurns();
    drawWormholeInfo();

    if ((vgap.replay && vgap.replay.running) || (vgap.getReplayUI && vgap.getReplayUI().isActive())) {
        redrawAndFilter.drawResources(null, null, null);
    } else {
        var reports = [];
        var reporter = function(report) {
            reports.push(report);
        };

        var nextTurnRst = McN_Tk.host.simulate(vgap, reporter);
        var nowEchoCluster = new McN_Tk.EchoCluster(redraw.planets.concat(redraw.ships));
        var nextTurnEchoCluster = new McN_Tk.EchoCluster(nextTurnRst.planets.concat(nextTurnRst.ships));
        var nextTurnShips = [];
        nextTurnRst.ships.forEach(function(ship) {
            nextTurnShips[ship.id] = ship;
        });

        drawHostRunReports(reports);

        redrawAndFilter.drawResources(nowEchoCluster, nextTurnEchoCluster, nextTurnShips);
    }
    if (redrawAndFilter.model.showShips) redrawAndFilter.drawShipLocations();
    drawExtraInfoForSelectedObject();
};

// Draw it soooomewhat fatter than the 1px #222 boundary that NU draws.
function drawSphereBoundary() {
    if (vgap.settings.sphere) {
        vgap.map.ctx.strokeStyle = "grey";
        vgap.map.ctx.lineWidth = 1;
        vgap.map.ctx.strokeRect(vgap.map.screenX(2000 - vgap.settings.mapwidth/2 - 10), vgap.map.screenY(2000 + vgap.settings.mapheight/2 + 10), (vgap.settings.mapwidth + 20) * vgap.map.zoom, (vgap.settings.mapheight + 20) * vgap.map.zoom);
    };
}

function drawPlanetNames() {
    if (vgap.map.planetnames) {
        redraw.planets.forEach(function(planet) {
            if (vgap.map.zoom >= 0.5) {
                var label = "P" + Math.abs(planet.id);
                label += getOwnerLabel(planet.ownerid);
                if (vgap.map.zoom >= 2) label += ": " + planet.name;
                var style = redrawAndFilter.model.colorForPlanet(planet);
                McN_Tk.drawNonoverlappingText(planet.x, planet.y, label, style, true);
            }
        });
    }
}

function hasBuildPrioFC(planet) {
    var fc = planet.friendlycode.toLowerCase();
    var firstIsPOrR = fc[0] == "r" || fc[0] == "p";
    var secondIsB = fc[1] == "b";
    var thirdIsDigit = "123456789".indexOf(fc[2]) >= 0;
    return firstIsPOrR && secondIsB && thirdIsDigit;
}

function drawPlanetInfoTurns() {
    if (vgap.map.zoom >= 0.5 && redrawAndFilter.model.showInfoturns) {
        redraw.planets.forEach(function(planet) {
            if (redraw.showPlanet(planet) && planet.infoturn != vgap.game.turn) {
                if (planet.infoturn > 0 && knowSomethingAbout(planet)) {
                    McN_Tk.drawNonoverlappingText(planet.x, planet.y, "info T"+planet.infoturn, redrawAndFilter.model.colorForPlanet(planet));
                }
            }
        });
    }
}

function drawHostRunReports(reports) {
    if (vgap.map.zoom < 0.5) return;

    reports.forEach(function(report) {
        if (report.type == "superrefit") {
            var ship = vgap.getShip(report.object.id);  // report.object is the next-turn ship
            if (ship.ownerid != vgap.player.id) return;  // we don't care about allied refits.
            if (!redraw["showPlayer"+ship.ownerid]) return;
            var note = redraw.superRefitInfo(report);
            McN_Tk.drawNonoverlappingText(ship.x, ship.y, note.note, note.color);
        }
    });
}

redraw.superRefitInfo = function(report) {
    var note = "S"+report.object.id+":";

    if (report.nothingrefitted) {
        note += " Nothing to refit!";
        return { note: note, color: "red" };
    } else {
        if (report.engines) note += " ->E" + report.engineId;
        if (report.beams) {
            note += " ->";
            note += report.beamId == 0 ? "nobeams" : McN_Tk.shortBeamName[report.beamId];
        }
        if (report.launchers) {
            note += " ->";
            if (report.launcherId == 0) {
                note += "notorps"
            } else {
                note += McN_Tk.shortTorpName[report.launcherId];
                if (report.ammo) note += "/" + report.ammo;
            }
        }
        return { note: note, color: "white" };
    }
}

function knowSomethingAbout(planet) {
    // Should cover Exploration, Dark Sense, Super Spy, Sensor Sweep, more? Does it?
    var knowTemp = planet.temp >= 0;
    var isOwned = planet.ownerid > 0;
    var knowNeutronium = planet.neutronium >= 0;
    return knowTemp || isOwned || knowNeutronium;
}

function drawOutdatedMinefieldWarnings() {
    if (vgap.map.zoom >= 0.5 && redrawAndFilter.model.showInfoturns) {
        vgap.minefields.forEach(function(mf) {
            if (mf.infoturn != vgap.game.turn && mf.id > 0) {  // Do not draw the info for duplicated minefields
                if (vgap.map.zoom > 2) {
                    McN_Tk.drawNonoverlappingText(mf.x, mf.y, "MF"+mf.id+" info from T"+mf.infoturn, "#aaa");
                } else {
                    McN_Tk.drawNonoverlappingText(mf.x, mf.y, "MF info T"+mf.infoturn, "#aaa");
                }
            }
        });
    }
}

function drawExtraInfoForSelectedObject() {
    if (vgap.map.activeShip) {
        var ship = vgap.map.activeShip;
        var x = ship.targetx;
        var y = ship.targety;
        if (ship.waypoints.length > 0) {
            var waypoint = ship.waypoints[ship.waypoints.length-1];
            x = waypoint.x;
            y = waypoint.y;
        }
        redrawAndFilter.drawInfoAround(ship);
        redrawAndFilter.drawMovementCirclesAround(x, y, ship.warp);
    } else if (vgap.map.activePlanet) {
        var planet = vgap.map.activePlanet;
        var x = planet.targetx || planet.x;
        var y = planet.targety || planet.y;
        redrawAndFilter.drawMovementCirclesAround(x, y);
    }
}

redrawAndFilter.drawInfoAround = function(ship) {
    if (redraw.isPod(ship)) {
        var r = redraw.isUnarmedPod(ship) ? McN_Tk.nonCombatPodScanRange() : McN_Tk.combatPodScanRange();
        McN_Tk.drawSingleMapDisc(ship.x, ship.y, r, "rgba(192,192,192,0.2)");
    } else {
        if (redraw.isHive(ship)) {
            McN_Tk.drawSingleMapDashedCircle(ship.x, ship.y, 100, "#008000", 7);
        }

        redrawAndFilter.drawEvasionFlare(ship);
    }

    if (canHyp(ship)) {
        var center = redrawAndFilter.oneButLastWaypointFor(ship)
        var waypoint = lastWaypointFor(ship);
        if (center.x != waypoint.x || center.y != waypoint.y) {
            drawHyperjumpBandAround(center.x, center.y);
        }
    }
};

redrawAndFilter.drawEvasionFlare = function(ship) {
    if (redrawAndFilter.isDrawingEvasionFlare(ship)) {
        var center = redrawAndFilter.oneButLastWaypointFor(ship)
        McN_Tk.forAllEvasionDeltas(ship, center, function(aim, arrive, interceptor) {
            if (!arrive) return;
            // somewhere around zoom of 30, the grid receives dots from NU
            // we want to be drawing larger circles sooner
            var r = vgap.map.zoom >= 10 ? 2 : 1;

            McN_Tk.drawScreenCircle(vgap.map.screenX(aim.x), vgap.map.screenY(aim.y), r, '#aaa');
            McN_Tk.drawScreenCircle(vgap.map.screenX(arrive.x), vgap.map.screenY(arrive.y), r, '#999');
            McN_Tk.drawScreenCircle(vgap.map.screenX(interceptor.x), vgap.map.screenY(interceptor.y), r, '#888');
        });
    }
};

redrawAndFilter.isDrawingEvasionFlare = function(ship) {
    var center = redrawAndFilter.oneButLastWaypointFor(ship);
    var target = lastWaypointFor(ship);
    var waypointDistance = Math.dist(center.x, center.y, target.x, target.y);
    var speed = ship.warp * ship.warp;
    if (McN_Tk.isGravitonic(ship)) speed *= 2;
    var waypointDistanceApproxWarpSquared = waypointDistance >= speed-1 && waypointDistance <= speed+5;

    var nearAnEvasionPoint = false;
    McN_Tk.forAllEvasionDeltas(ship, center, function(aim, arrive, interceptor) {
        if (!arrive) return;
        var waypointEvasionDistance = Math.dist(target.x, target.y, aim.x, aim.y);
        if (waypointEvasionDistance <= 5) nearAnEvasionPoint = true;
    });

    return (waypointDistanceApproxWarpSquared || nearAnEvasionPoint);
}

function canHyp(ship) {
    function canHullHyp(hullId) {
        return hullId == 51 || hullId == 77 || hullId == 87 || hullId == 110;
    }
    return canHullHyp(ship.hullid);
}

function drawThickCircle(x, y, radius, color, thickness) {
    for (var i = 0; i < thickness; i++) {
        McN_Tk.drawMapCircle(x, y, radius + i, color);
    }
}

redrawAndFilter.oneButLastWaypointFor = function(ship) {
    if (ship.waypoints.length > 1) {
        var index = ship.waypoints.length - 2;
        var waypoint = ship.waypoints[index];
        return { x: waypoint.x, y: waypoint.y };
    } else if (ship.waypoints.length == 1) {
        return {x: ship.targetx, y: ship.targety};
    } else {
        return {x: ship.x, y: ship.y};
    }
}

lastWaypointFor = function(ship) {
    if (ship.waypoints.length > 0) {
        var index = ship.waypoints.length - 1;
        var waypoint = ship.waypoints[index];
        return { x: waypoint.x, y: waypoint.y };
    } else {
        return {x: ship.targetx, y: ship.targety};
    }
}

redrawAndFilter.drawMovementCirclesAround = function(x, y, warp) {
    drawNormalMovementAround(x, y, warp);
    McN_Tk.drawSingleMapDashedCircle(x, y, 100, "#66a", [1, 3], 1);
    drawHyperjumpBandAround(x, y);
}

function drawNormalMovementAround(x, y, warp) {
    // Note: W1 circles are too obnoxious when playing warp well games.
    if (!warp) warp = 9;
    var sw = 0.5 * vgap.map.zoom;
    if (sw < 1) sw = 1;
    for (var w=warp; w<=9; w++) {
        var r = w*w + 0.25;
        var shade = w == warp ? 200 : w * 10 + 30;
        var rgba = "rgba("+shade+", "+shade+", "+shade+", 0.5)";
        McN_Tk.drawSingleMapDashedCircle(x, y, r, rgba, w+1, sw);
    }
    var sw = vgap.map.zoom;
    if (sw < 1) sw = 1;
    if (warp > 1) {
        r = 2 * (warp*warp + 0.25);
        shade = 200;
        rgba = "rgba("+shade+", "+shade+", "+shade+", 0.5)";
        McN_Tk.drawSingleMapDashedCircle(x, y, r, rgba, warp+1, sw);
    }
    if (warp != 9) {
        r = 2 * (9*9 + 0.25);
        shade = 200;
        rgba = "rgba("+shade+", "+shade+", "+shade+", 0.5)";
        McN_Tk.drawSingleMapCircle(x, y, r, rgba, sw);
    }
}

function drawHyperjumpBandAround(x, y) {
    McN_Tk.drawSingleMapCircle(x, y, 350, "#888888", 1);
    McN_Tk.drawSingleMapBand(x, y, 350, colorToRGBA("#888888", 0.3), 20);
};

redrawAndFilter.drawResources = function(nowEchoCluster, nextTurnEchoCluster, nextTurnShips) {
    if (vgap.map.showresources) return;
    if (vgap.map.zoom < 0.5) return;

    var model = redrawAndFilter.model;

    var activeResources = model.resources.filter(function(resource) {
        return model["show"+resource];
    });
    var onlyOneResourceShown = activeResources.length == 1;
    if (onlyOneResourceShown) {
    }

    for (var xy in model.resourceLocations) {
        var location = model.resourceLocations[xy];
        var x = vgap.map.screenX(location.x);
        var y = vgap.map.screenY(location.y);
        model.resources.forEach(function(resource) {
            if (model["show"+resource]) {
              var radius = 0;
                if (resource == "Goldenrod") {
                  radius = 13;
                  if ((location.temp >= 45) && (location.temp <= 55)) {
                      var color = tempColor(location.temp);
                      McN_Tk.drawNonoverlappingText(location.x, location.y, "" + location.temp, color);
                      // drawThickCircle(location.x, location.y, radius, color, 5);
                      McN_Tk.drawMapCircle(location.x, location.y, radius, color, 7);
                  }
                }
                else if (resource == "NotDevNatives" ||
                         resource == "NotDevNoNatives" ||
                         resource == "UnderDevNatives" ||
                         resource == "UnderDevNoNatives" ||
                         resource == "CanBuildStarbase") {
                  // Planetary Management planet filters as map highlights
                  var locKey = resource.toLowerCase();
                  if (location[locKey] > 0) {
                      var color = redraw.colorForResource(resource);
                      var short = resource2Short[resource];
                      McN_Tk.drawNonoverlappingText(location.x, location.y, short + " " + location[locKey], color);
                      McN_Tk.drawMapCircle(location.x, location.y, 12, color);
                  }
                }
                else if (resource == "Nativeclans") {
                    if (location.nativeclans > 0) {
                        var planet = vgap.planetAt(location.x, location.y);
                        if (planet) {
                            var name = model.shortRaceNames[planet.nativeracename];
                            var style = vgap.player.raceid == 12 ? model.nativeColorsForHorwasp[planet.nativeracename] : model.nativeColors[planet.nativeracename];
                            McN_Tk.drawNonoverlappingText(location.x, location.y, name, style);

                            var income = model.incomeForNativesForDropInHappiness(planet, 30);  // should be on location
                            radius = Math.sqrt(income) / scale;
                            var government = planet.nativegovernment ? planet.nativegovernment : 5;
                            McN_Tk.drawMapDashedCircle(location.x, location.y, radius, redraw.colorForResource(resource), government + 1);
                        } else {
                            // Horwasp Farm
                            radius = Math.sqrt(location.nativeclans) / scale;
                            McN_Tk.drawMapDashedCircle(location.x, location.y, radius, redraw.colorForResource(resource), 5);
                        }
                    }
                } else if (resource == "Ammo") {
                    if (location.ammo) {
                        var ammoTypes = vgap.torpedos.length + 1;
                        for (var i=0; i<ammoTypes; i++) {
                            if (location.ammo[i]) {
                                radius = Math.sqrt(location.ammo[i] * 10) / scale;
                                if (radius > 0) {
                                    var angFrom = i * Math.PI * 2 / ammoTypes - Math.PI/2;
                                    var angTo = (i+1) * Math.PI * 2 / ammoTypes - Math.PI/2;
                                    McN_Tk.drawFilledArc(location.x, location.y, radius, angFrom, angTo, model.ammoColors[i]);
                                }
                            }
                        }
                    }
                } else if (resource == "Temp") {
                    if (location.temp >= 0) {
                        var color = tempColor(location.temp);
                        McN_Tk.drawNonoverlappingText(location.x, location.y, "" + location.temp, color);
                        McN_Tk.drawMapCircle(location.x, location.y, 10, color);
                    }
                } else if (resource == "Surface") {
                    // Combined surface minerals (already summed into location.surface during collection)
                    radius = Math.sqrt(location.surface || 0) / scale;

                    if (onlyOneResourceShown && nowEchoCluster) {
                        var info = redraw.detailedInfo(
                            blup(nowEchoCluster.findObjects(location.x, location.y, 0)),
                            blup(nextTurnEchoCluster.findObjects(location.x, location.y, 0)),
                            nextTurnShips,
                            "surface"
                        );
                        if (info) McN_Tk.drawNonoverlappingText(location.x, location.y, info, redraw.colorForResource(resource));
                    }

                    if (radius > 0) McN_Tk.drawMapCircle(location.x, location.y, radius, redraw.colorForResource(resource));
                } else {
                    radius = Math.sqrt(location[resource.toLowerCase()]) / scale;
                    if (resource == "Clans") {
                        if (location.larva > 0) {
                            var larvaRadius = Math.sqrt(location.larva) / scale;
                            if (larvaRadius > maxLarvaRadius()) larvaRadius = maxLarvaRadius();
                            if (larvaRadius > 0) McN_Tk.drawMapDashedCircle(location.x, location.y, larvaRadius, redraw.colorForResource(resource), 5);
                        }
                        if (radius > maxColRadius()) radius = maxColRadius();
                    } else if (resource == "Supplies") {
                        if (radius > maxSuppliesRadius()) radius = maxSuppliesRadius();
                    } else if (resource == "Megacredits") {
                        if (radius > maxMCRadius()) radius = maxMCRadius();
                    }

                    if (onlyOneResourceShown && nowEchoCluster) {  // the arguments to drawResources are null when vgap.replay.running
                        var info = redraw.detailedInfo(
                            blup(nowEchoCluster.findObjects(location.x, location.y, 0)),
                            blup(nextTurnEchoCluster.findObjects(location.x, location.y, 0)),
                            nextTurnShips,
                            resource.toLowerCase()
                        );
                        if (info) McN_Tk.drawNonoverlappingText(location.x, location.y, info, redraw.colorForResource(resource));
                    }

                    if (radius > 0) McN_Tk.drawMapCircle(location.x, location.y, radius, redraw.colorForResource(resource));
                }
            }
        });
    }
};

function blup(objects) {
    var result = {};
    objects.forEach(function(obj) {
        if (obj.isPlanet) {
            result.planet = obj;
        } else {
            if (!result.ships) result.ships = [];
            result.ships.push(obj);
        }
    });
    return result;
}


function maxIncomeRadius() {
    return Math.sqrt(redraw.MaxIncome) / 2;
}

function maxColRadius() {
    return maxIncomeRadius() + 3 / vgap.map.zoom;
}

function maxLarvaRadius() {
    return maxIncomeRadius() + 6 / vgap.map.zoom;
}

function maxSuppliesRadius() {
    return maxIncomeRadius() + 9 / vgap.map.zoom;
}

function maxMCRadius() {
    return maxIncomeRadius() + 12 / vgap.map.zoom;
}

function tempColor(temperature) {
    var red, green, blue;

    // Helper to clamp a value to 0–255
    function clamp(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
    }

    if (vgap.player.raceid == 7) {
        // Crystal Confederation – blue → cyan progression
        red = 28 + temperature;
        green = 28 + temperature;
        blue = 228 - temperature;
        if (temperature == 0) blue = 255;
    } else {
        // Normal races
        if (temperature >= 45 && temperature <= 55) {
            // Goldenrod for the temperate “sweet spot”
            red = 218;
            green = 165;
            blue = 32;
        } else {
            red = 128 + temperature - 50;
            green = 128;
            blue = 128 - temperature + 50;

            if (temperature < 15 && vgap.player.raceid != 10) {
                red -= 50;
                green -= 50;
                blue += 50;
            }
            if (temperature >= 85) {
                red += 50;
                green -= 50;
                blue -= 50;
            }
        }
    }

    // Clamp all channels
    red = clamp(red);
    green = clamp(green);
    blue = clamp(blue);

    return "rgb(" + red + ", " + green + ", " + blue + ")";
}

redrawAndFilter.drawShipLocations = function() {
    for (var xy in redrawAndFilter.model.shipMapLocations) {
        var location = redrawAndFilter.model.shipMapLocations[xy];

        redraw.drawOwnShipCircle(location);
        redraw.drawEnemyShipCircle(location);
        redraw.drawShipLabels(location);
    }
};

redraw.drawOwnShipCircle = (location) => {
    if (location.owners[vgap.player.id]) {
        var color = McN_Tk.colorForShipOwner(vgap.player.id);
        McN_Tk.drawMapCircle(location.x, location.y, redrawAndFilter.ownShipRadius() / vgap.map.zoom, color);
    }
};

redraw.drawEnemyShipCircle = (location) => {
    var owners = location.owners;

    var amount = 0;
    owners.forEach(function(ships, owner) {
        if (ships) amount++;
    });
    if (owners[vgap.player.id]) amount--;  // owner has its own circle

    var r = redrawAndFilter.enemyShipRadius() / vgap.map.zoom;
    var count = 0;
    owners.forEach(function(ships, owner) {
        if (!ships) return;
        if (owner == vgap.player.id) return;  // owner has its own circle

        var angFrom = count * Math.PI * 2 / amount;
        var angTo = (count+1) * Math.PI * 2 / amount;
        var color = McN_Tk.colorForShipOwner(owner);
        McN_Tk.drawMapArc(location.x, location.y, r, angFrom, angTo, color);
        count++;
    });
};

redraw.drawShipLabels = (location) => {
    if (vgap.map.zoom <= 0.5) return;

    if (vgap.map.zoom <= 1) {
        redraw.drawShipCountLabels(location);
        return;
    }

    if (vgap.map.zoom <= 1.5) {
        redraw.labelsFor(location).forEach(function(label) {
            McN_Tk.drawNonoverlappingText(location.x, location.y, label.text, McN_Tk.colorForShipOwner(label.owner));
        });
        return;
    }

    // names / hull-only / equip, BV, etc
    // if same thing, sort on ID or on BV???  <-- rather important, actually...
    // How to deal with notes? I don't like the separate NOT for notes, anymore...
    if (redraw.showShips == "idsAndNames") {
        location.shipIdsAndNames.forEach((ship) => {
            var label = redraw.shipIdAndName(ship);
            McN_Tk.drawNonoverlappingText(location.x, location.y, label, McN_Tk.colorForShip(ship));
        });
    } else if (redraw.showShips == "idsAndEquip") {
	// if zoom < 2  /// unify comparisons...
	// if zoom >= 1.4, show hull and armament
	// if zoom >= 2 show BV and/or other useful info
        location.shipIdsAndNames.forEach((ship) => {
            var label = redraw.shipIdAndEquipment(ship);
            McN_Tk.drawNonoverlappingText(location.x, location.y, label, McN_Tk.colorForShip(ship));
        });
    } else if (redraw.showShips == "battleInfo") {
        var labels = location.shipIdsAndNames.map(shipBattleInfo);
        labels.sort(function(one, two) { return one.battleValue - two.battleValue; });
        labels.forEach(function(label) {
            McN_Tk.drawNonoverlappingText(location.x, location.y, label.text, McN_Tk.colorForShipOwner(label.owner));
        })
    } else if (redraw.showShips == "hulltypes") {
        redraw.labelsFor(location).forEach(function(label) {
            McN_Tk.drawNonoverlappingText(location.x, location.y, label.text, McN_Tk.colorForShipOwner(label.owner));
        });
    }
}

redraw.drawShipCountLabels = (location) => {
    var owners = location.owners;

    owners.forEach(function(shipsByHullId, owner) {
        if (!shipsByHullId) return;

        var count = 0;
        shipsByHullId.forEach((ships) => {
            if (ships) count += ships.length;
        });
        var pluralLabel = count > 1 ? "s" : "";
        var label = count + getOwnerLabel(owner) + " ship" + pluralLabel;
        McN_Tk.drawNonoverlappingText(location.x, location.y, label, McN_Tk.colorForShipOwner(owner));
    });
};

redraw.shipIdAndName = function(ship) {
    return ""+Math.abs(ship.id)+": " + ship.name;
}

redraw.shipIdAndEquipment = function(ship) {
    return ""+Math.abs(ship.id)+": " + shipDescription(ship.hullid, ship.engineid, ship.beams, ship.beamid, ship.torps, ship.torpedoid, ship.ammo);
}

function getOwnerLabel(ownerid) {
    return ownerid == 0 || ownerid == vgap.player.id || McN_Tk.labelFor(ownerid) == "" ? "" : " " + McN_Tk.labelFor(ownerid);
}

function shipBattleInfo(ship) {
    var label = (vgap.map.zoom <= 1 ? "S" : "") + Math.abs(ship.id);
    label += getOwnerLabel(ship.ownerid);
    if (vgap.map.zoom > 1) {
	label += ":";
	label += " " + McN_Tk.shortHullName(vgap.getHull(ship.hullid));
	if (vgap.map.zoom >= 2) {
	    var battleValue = vgap.getBattleValue(ship);
	    if (battleValue != "" && battleValue < 1015) label += " BV:" + battleValue;  // old client has "" for enemy ships
	    if (ship.enemy > 0) label += " PE:" + ship.enemy;
	    if (ship.mission == 3) label += " Kill!";
	    if (ship.neutronium == 0 && ship.ownerid == vgap.player.id) label += " OoF";
            if (hasNTPFC(ship)) label += " "+ship.friendlycode;
	    if (hasGloryDevice(ship) && hasGDFC(ship)) label += " "+ship.friendlycode;
	    if (isRobbing(ship)) label += " Rob";
	    if (isCloaking(ship)) label += " Cloak";
	    if (onRecloakIntercept(ship)) label += " ReclkInt";
	    else if (onPriorityIntercept(ship)) label += " PrioInt";
	    if (ship.mission == 20) label += " C&I";
	    if (ship.damage > 0) label += " dmg:"+ship.damage+"%";
	}
    }
    return { text: label, battleValue: battleValue, owner: ship.ownerid };
}

function hasNTPFC(ship) {
    return ship.friendlycode.toLowerCase() == "ntp";
}

function hasGloryDevice(ship) {
    var hullId = ship.hullid;
    return (hullId == 39 ||  // D19b
            hullId == 1039 ||  // D19c
            hullId == 41 ||  // Saber
            hullId == 1041 ||  // Shield Gen
            hullId == 1034); // D7b
}

function hasGDFC(ship) {
    var fc = ship.friendlycode.toLowerCase();
    return fc == "trg" || fc == "pop";
}

function isCloaking(ship) {
    if (ship.ownerid == 0) return false;
    var race = vgap.getPlayer(ship.ownerid).raceid;
    return ship.mission == 9 || (race == 3 && ship.mission == 8);
}

function isRobbing(ship) {
    if (ship.ownerid == 0) return false;
    var race = vgap.getPlayer(ship.ownerid).raceid;
    return race == 5 && ship.mission == 8;
}

function onRecloakIntercept(ship) {
    return ship.hullid == 2033 && ship.mission == 7;
}

function onPriorityIntercept(ship) {
    var hull = vgap.getHull(ship.hullid);
    return hull.cancloak && ship.mission == 7;
}

function shipDescription(hullId, engineId, beams, beamId, launchers, launcherId, ammo) {
    var hull = vgap.getHull(hullId);
    var result = McN_Tk.shortHullName(hull);
    if (engineId > 0) result += " E"+engineId;
    if (beams > 0 && beamId > 0) result += " "+beams+McN_Tk.shortBeamName[beamId];
    if (launchers > 0 && launcherId > 0) result += " "+launchers+McN_Tk.shortTorpName[launcherId];
    if (ammo > 0) {
        if (hull.fighterbays > 0) result += " f";
        result += "/"+ammo;
    }
    return result;
}

// Ionstorms

var ionstormRectangles;
var ionstormsCachedForGame = 0;
var ionstormImages = {};

function processIonstorms() {
    if (vgap.game.id != ionstormsCachedForGame) {
        ionstormsCachedForGame = vgap.game.id;
        ionstormImages = {};
    }
    ionstormRectangles = [];
    var disturbances = McN_Tk.partitionBy(vgap.ionstorms, function(ion) {
        if (ion.parentid == 0) {
            return ion.id;
        } else if (ion.id < 0) {
            // Must match the negative ID
            return -Math.abs(ion.parentid);  // use minus abs, in case NU fixes this
        } else {
            return ion.parentid;
        }
    });
    for (var key in disturbances) {
        var disturbance = disturbances[key];  // So that's one disturbance with multiple clouds
        new McN_Tk.BoundingRectangles(disturbance).rectangles().forEach(function(rect) {
            ionstormRectangles.push(rect);
            coverAllBothWays(rect.circles);
        });
    }
}

vgapMap.prototype.oldRedrawAndFilterDrawIon = vgapMap.prototype.drawIon;
vgapMap.prototype.drawIon = function(screenX, screenY, voltage, screenRadius, ctx, ionstorm) {
    if (redrawAndFilter.model.showIonstorms) {
        if (ionstorm.parentid == 0) ionstorm.parentid = "dontdrawthedot";
        this.oldRedrawAndFilterDrawIon(screenX, screenY, voltage, screenRadius, ctx, ionstorm);
        if (ionstorm.parentid == "dontdrawthedot") ionstorm.parentid = 0;
        McN_Tk.drawScreenCircle(screenX, screenY, screenRadius, "#ff3", ionstorm.parentid == 0 ? 0.3 : 0.1);
        ionstorm.arcs.forEach(function(arc) {
            McN_Tk.drawScreenArc(screenX, screenY, screenRadius, -arc.angle2, -arc.angle1, "rgba(255, 255, 50, 0.3)");
        });
    }
};

function drawIonstorms() {
    if (redrawAndFilter.model.showIonstorms) {
        if (vgap.settings.nuionstorms) {
            if (!redrawAndFilter.isInReplay) redrawAndFilter.highlightDangerousIonstormParts();
        } else {
            redrawAndFilter.showIonstormVoltages();
        }
    }
}

redraw.drawIonstormWaypoints = function() {
    vgap.ionstorms.forEach(function(ion) {
        if (vgap.settings.nuionstorms && ion.parentid != 0) return;
        var x = ion.x;
        var y = ion.y;
        var speed = ion.warp * ion.warp;
        var tx = x + Math.round(Math.sin(Math.toRad(ion.heading)) * speed);
        var ty = y + Math.round(Math.cos(Math.toRad(ion.heading)) * speed);
        var color = "rgba(255, 255, 0, 0.4)";
        redraw.drawWaypoint(x, y, tx, ty, color);
    });
};

redrawAndFilter.highlightDangerousIonstormParts = function() {
    if (ionstormImages[vgap.game.turn] == null) makeIonstormImages();

    ionstormImages[vgap.game.turn].forEach(function(image) {
        if (image.canvas == null) {
            image.canvas = McN_Tk.canvasFor(image.width, image.height, image.data);
        }
        var screenX = vgap.map.screenX(image.x - 0.5);
        var screenY = vgap.map.screenY(image.y + 0.5);
        McN_Tk.drawImage(screenX, screenY, image.width*vgap.map.zoom, image.height*vgap.map.zoom, image.canvas);
    });
};

function makeIonstormImages() {
    ionstormImages[vgap.game.turn] = ionstormRectangles.map(function(rectangle) {
        var w = rectangle.maxX - rectangle.minX + 1;
        var h = rectangle.maxY - rectangle.minY + 1;
        var imgData = vgap.map.ctx.createImageData(w, h);

        var cloud = rectangle.circles[0];
        var parent = cloud.parentid == 0 ? cloud : vgap.getIon(cloud.parentid);
        var strengthening = parent.voltage % 2 == 1;

        rectangle.circles.forEach(function(storm) {
            var dr = strengthening ? storm.radius : storm.radius + 10;
            for (var y=storm.y+dr; y>=storm.y-dr; y--) {
                for (var x=storm.x-dr; x<=storm.x+dr; x++) {
                    var dist2 = (storm.x-x) * (storm.x-x) + (storm.y-y) * (storm.y-y);
                    var base = (rectangle.maxY-y) * w * 4 + (x-rectangle.minX) * 4;
                    if (dist2 <= dr * dr) {
                        imgData.data[base + 2] += strengthening ?
                            Math.ceil((storm.voltage+10) * (1 - (Math.sqrt(dist2) / storm.radius))) :
                            Math.ceil(storm.voltage * (1 - (Math.sqrt(dist2) / (storm.radius + 10))));
                    }
                    if (dist2 <= storm.radius * storm.radius) {
                        imgData.data[base + 3] += Math.ceil(storm.voltage * (1 - (Math.sqrt(dist2) / storm.radius)));
                    }
                }
            }
        });

        for (y=0; y<h; y++) {
            for (x=0; x<w; x++) {
                var base = y * w * 4 + x * 4;
                imgData.data[base + 0] = 255;
                imgData.data[base + 1] = 0;
                var voltage = imgData.data[base + 3];
                var potential = imgData.data[base + 2];  // pardon the pun
                if (voltage >= 451) {
                    imgData.data[base + 2] = 255;
                    imgData.data[base + 3] = 200;
                } else if (voltage >= 410) {
                    imgData.data[base + 2] = 128;
                    imgData.data[base + 3] = 150;
                } else if (voltage >= 150) {
                    imgData.data[base + 2] = 0;
                    imgData.data[base + 3] = 100;
                } else if (potential >= 150) {
                    imgData.data[base + 2] = 0;
                    imgData.data[base + 3] = 50;
                } else {
                    imgData.data[base + 2] = 0;
                    imgData.data[base + 3] = 0;
                }
            }
        }

        return { x: rectangle.minX, y: rectangle.maxY, width: w, height: h, data: imgData };
    });
}

redrawAndFilter.showIonstormVoltages = function() {
    vgap.ionstorms.forEach(function(ionstorm) {
        var color = "yellow";
        var msg = "";
        if (ionstorm.voltage >= 140) {
            color = "rgba(255, 64,  0, 200)";
            msg = "(watch it)";
        }
        if (ionstorm.voltage >= 150) {
            color = "rgba(255, 0,   0, 200)";
            msg = "dangerous";
        }
        if (ionstorm.voltage >= 410) {
            color = "rgba(255, 0, 128, 200)";
            msg = "very dangerous!";
        }
        if (ionstorm.voltage >= 451) {
            color = "rgba(255, 0, 255, 200)";
            msg = "insanely dangerous";
        }
        McN_Tk.drawNonoverlappingText(ionstorm.x, ionstorm.y, ionstorm.voltage+"MeV "+msg, color);
    });
};

// Nebulas

function processNebulas(nebulas) {
    var namedNebulas = McN_Tk.partitionBy(nebulas, function(neb) { return neb.name; });
    for (var key in namedNebulas) {
        var nebula = namedNebulas[key];  // So that's ONE cloud with MULTIPLE circles
        new McN_Tk.BoundingRectangles(nebula).rectangles().forEach(function(rect) {
            coverAllBothWays(rect.circles);
        });
    }
}

redraw.drawNebula_old = vgapMap.prototype.drawNebula;
vgapMap.prototype.drawNebula = function(screenX, screenY, neb, _ctx) {
    if (redrawAndFilter.model.showNebulas) {
        redraw.drawNebula_old.apply(this, arguments);
        neb.arcs.forEach(function(arc) {
            McN_Tk.drawScreenArc(screenX, screenY, neb.radius*vgap.map.zoom, -arc.angle2, -arc.angle1, "rgba(50, 255, 50, 0.3)");
        });
    }
};

// Tiny minefields

var tinyMinefieldLocs;

function findTinyMinefields() {
    tinyMinefieldLocs = {};
    var setLocIfTinyMinefields = function(obj) {
        var index = obj.x+","+obj.y;
        if (!tinyMinefieldLocs[index]) {
            var tinyMinefields = vgap.minefieldsAt(obj.x, obj.y).filter(function(mf) {
                return mf.units <= 100;
            });

            if (tinyMinefields.length > 0) {
                tinyMinefieldLocs[index] = {
                    x: obj.x, y: obj.y,
                    normal: tinyMinefields.filter(function(mf) { return !mf.isweb }).length,
                    web: tinyMinefields.filter(function(mf) { return mf.isweb }).length
                };
            }
        }
    }
    vgap.myships.forEach(setLocIfTinyMinefields);
    vgap.myplanets.forEach(setLocIfTinyMinefields);
}

function drawTinyMinefieldWarnings() {
    for (var key in tinyMinefieldLocs) {
        var loc = tinyMinefieldLocs[key];
        if (loc.x && loc.y) { // just make sure it's an honest key/value pair, f* JS
            var text = "";
            if (loc.normal > 0) text = text + loc.normal + " tiny minefield" + (loc.normal > 1 ? "s" : "");
            if (loc.web > 0) {
                if (loc.normal > 0) text = text + " and ";
                text = text + loc.web + " tiny web" + (loc.web > 1 ? "s" : "");
            }
            McN_Tk.drawNonoverlappingText(loc.x, loc.y, text, "#ff44ff");
        }
    };
}

vgapMap.prototype.drawWaypoints = function(_ctx, _selectedShipId, _selectedShipColor) {
    if (vgap.map.zoom < 0.5) return;

    if (redrawAndFilter.model.showShips) {
        redraw.drawShipWaypoints();
        redraw.drawPodsBeingBuiltWaypoints();
    }
    if (redrawAndFilter.model.showIonstorms) redraw.drawIonstormWaypoints();
};


Waypoint = function(x1, y1, x2, y2, owner, type, state, warp) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.owner = owner;
    this.type = type;
    this.state = state;
    this.warp = warp;
}

redraw.waypointsFor = function(ship) {
    var result = [];

    if (ship.ownerid == vgap.player.id) {
        var type = "normal";
        var state = "normal";
        if (ship == vgap.map.activeShip) state = "active";

        if (vgap.isChunnelling(ship)) {
            var chunnelTarget = vgap.getChunnelTarget(ship);
            result.push(new Waypoint(ship.x, ship.y, chunnelTarget.x, chunnelTarget.y, ship.ownerid, "chunnel", state, ship.warp));
        } else {
            if (redrawAndFilter.model.isPod(ship)) type = "pod";

            var tower = vgap.isTowTarget(ship.id);
            if (tower) {
                if (ship != vgap.map.activeShip) return [];  // prevent purple waypoint when looking at e.g. a planet
                ship = tower;
                state = "towed";
            }

            if (ship.targetx == ship.x && ship.targety == ship.y) return [];  // no waypoint;
            var target = {x: ship.targetx, y: ship.targety};

            var checkHyping = function(start, finish) {
                if (vgap.isHyping(ship)) {
                    type = "hyperJump";
                    var dist = Math.dist(start.x, start.y, finish.x, finish.y);
                    if (dist < 340 || dist > 360) state = "willNotGetThere";
                }
            };

            var availableFuel = ship.neutronium;
            var checkOutOfFuel = function(start, finish) {
                if (!redrawAndFilter.model.isPod(ship)) {
                    var fuelUsage = vgap.getFuelUsage(start.x, start.y, finish.x, finish.y, ship);
                    if (fuelUsage > availableFuel) state = "outOfFuel";
                    availableFuel -= fuelUsage;
                }
            };

            checkHyping(ship, target);
            checkOutOfFuel(ship, target);
            result.push(new Waypoint(ship.x, ship.y, target.x, target.y, ship.ownerid, type, state, ship.warp));
            // technically, set tx&ty to where you end up. Usually the planet instead of the warpwell
            // this influences the amount of fuel needed for the next waypoint!
            // Note: nu.js does not do that, either

            if (ship.id > 0) {  // NU does not draw secondary waypoints for duplicated ships, let's follow their example...
                ship.waypoints.forEach(function (waypoint) {
                    //     checkHyping(target, waypoint);
                    checkOutOfFuel(target, waypoint);
                    result.push(new Waypoint(target.x, target.y, waypoint.x, waypoint.y, ship.ownerid, type, state, ship.warp));
                    target = {x: waypoint.x, y: waypoint.y};
                });
            }
        }
    } else {
        if (ship.targetx != ship.x || ship.targety != ship.y) {
            result.push(new Waypoint(ship.x, ship.y, ship.targetx, ship.targety, ship.ownerid, "normal", "normal", ship.warp));
            var target = {x: ship.targetx, y: ship.targety};
            if (ship.id > 0) {  // NU does not draw secondary waypoints for duplicated ships, let's follow their example...
                ship.waypoints.forEach(function(waypoint) {
                    result.push(new Waypoint(target.x, target.y, waypoint.x, waypoint.y, ship.ownerid, "normal", "normal", ship.warp));
                    target = {x: waypoint.x, y: waypoint.y};
                });
            }
        }
    }
    return result;
};

redraw.drawShipWaypoints = function() {
    var priorities = {
        normal: 0,
        towed: 2,
        outOfFuel: 3,
        willNotGetThere: 4,
        active: 5
    };
    var waypoints = [];
    if (redrawAndFilter.model.showShips && redrawAndFilter.model.showWaypoints) {
        redraw.ships.forEach(function(ship) {
            if (redrawAndFilter.model.showShip(ship)) {
                waypoints = waypoints.concat(redraw.waypointsFor(ship));
            } else {
                if (ship === vgap.map.activeShip) waypoints = redraw.waypointsFor(vgap.map.activeShip);
            }
        });
    } else {
        if (vgap.map.activeShip) waypoints = redraw.waypointsFor(vgap.map.activeShip);
    }

    waypoints.sort(function(a, b) {
        return priorities[a.state] - priorities[b.state];
    });

    waypoints.forEach(function(waypoint) {
        var color, pattern = null;
        switch (waypoint.type) {
            case "chunnel":
                pattern = [9, 4];
                break;
            case "hyperJump":
                pattern = [2, 2];
                break;
            case "pod":
                color = McN_Tk.fadedColorForShipOwner(waypoint.owner);
                break;
        }
        var firstBlack = false;
        var fadeHalfway = waypoint.type == "pod" && waypoint.state != "active" && Math.dist(waypoint.x1, waypoint.y1, waypoint.x2, waypoint.y2) > 243;
        switch (waypoint.state) {
            case "active":
                color = "yellow";
                pattern = pattern || [waypoint.warp+1, 9-waypoint.warp];
                firstBlack = waypoint.warp != 9;
                break;
            case "outOfFuel":
                color = "#ff6600";
                pattern = pattern || [waypoint.warp+1, 9-waypoint.warp];
                pattern = pattern.concat([pattern[0], 25]);
                firstBlack = true;
                break;
            case "towed":
                color = "#ff00ff";
                break;
            case "willNotGetThere":
                color = "#ff0000";
                pattern = pattern.concat(pattern, [pattern[0], 25]);
                firstBlack = true;
                break;
            default:
                color = color || McN_Tk.colorForShipOwner(waypoint.owner);
                pattern = pattern || [waypoint.warp+1, 9-waypoint.warp];
                break;
        }
        if (McN_Tk.doSphereDuplication()) {
            McN_Tk.forAllSphereRectangles(waypoint.x1, waypoint.y1, waypoint.x2, waypoint.y2, function(x1, y1, x2, y2) {
                if (firstBlack) redraw.drawWaypoint(x1, y1, x2, y2, "black", null, fadeHalfway);
                redraw.drawWaypoint(x1, y1, x2, y2, color, pattern, fadeHalfway);
            });
        } else {
            var mx = (waypoint.x1 + waypoint.x2) / 2,
                my = (waypoint.y1 + waypoint.y2) / 2,
                r = Math.dist(waypoint.x1, waypoint.y1, waypoint.x2, waypoint.y2) / 2;
            if (vgap.map.isVisible(mx, my, r)) {
                if (firstBlack) redraw.drawWaypoint(waypoint.x1, waypoint.y1, waypoint.x2, waypoint.y2, "black", null, fadeHalfway);
                redraw.drawWaypoint(waypoint.x1, waypoint.y1, waypoint.x2, waypoint.y2, color, pattern, fadeHalfway);
            }
        }
    });
};

redraw.drawPodsBeingBuiltWaypoints = function() {
    var drawWaypoint = function(x, y, tx, ty, color, fadeHalfway) {
        if (McN_Tk.doSphereDuplication()) {
            McN_Tk.forAllSphereRectangles(x, y, tx, ty, function(x1, y1, x2, y2) {
                redraw.drawWaypoint(x1, y1, x2, y2, color, null, fadeHalfway);
            });
        } else {
            redraw.drawWaypoint(x, y, tx, ty, color, null, fadeHalfway);
        }
    }

    var drawWaypointForPod = function(planet) {
        if (planet.podhullid > 0) {
            var x = planet.x;
            var y = planet.y;
            var tx, ty;
            var color = McN_Tk.fadedColorForShipOwner(planet.ownerid);  // color for pod, not planet
            if (planet.builtdefense > 0) {
                var acceleratorId = planet.builtdefense;  // WTF?!?
                var accelerator = vgap.getShip(acceleratorId);
                tx = accelerator.x;
                ty = accelerator.y;
                drawWaypoint(x, y, tx, ty, color, Math.dist(x, y, tx, ty) > 243);
                x = tx;
                y = ty;
            }
            tx = planet.targetx;
            ty = planet.targety;
            drawWaypoint(x, y, tx, ty, color, Math.dist(x, y, tx, ty) > 243);
        }
    };

    if (redrawAndFilter.model.showWaypoints) {
        redraw.planets.forEach(drawWaypointForPod);
    } else {
        if (vgap.map.activePlanet) drawWaypointForPod(vgap.map.activePlanet);
    }
};

// Using map coordinates

redraw.drawWaypoint = function(x1, y1, x2, y2, color, pattern, fade) {
    var startX = vgap.map.screenX(x1);
    var startY = vgap.map.screenY(y1);
    var pointX = vgap.map.screenX(x2);
    var pointY = vgap.map.screenY(y2);

    var ctx = vgap.map.ctx;
    ctx.save();
      ctx.beginPath();
        var dx = pointX - startX;
        var dy = pointY - startY;
        var len = Math.sqrt(dx*dx + dy*dy);
        var perpDx = -dy / len;
        var perpDy = dx / len;
        var startWidth = vgap.map.zoom <= 1.0 ? 1.5 : 2.0;
        var pointWidth = 0.5;
        ctx.moveTo(startX + startWidth * perpDx, startY + startWidth * perpDy);
        ctx.lineTo(startX - startWidth * perpDx, startY - startWidth * perpDy);
        ctx.lineTo(pointX - pointWidth * perpDx, pointY - pointWidth * perpDy);
        ctx.lineTo(pointX + pointWidth * perpDx, pointY + pointWidth * perpDy);
        ctx.lineTo(startX + startWidth * perpDx, startY + startWidth * perpDy);
      ctx.clip();

      if (fade) {
        var hiddenMiddle = ctx.createLinearGradient(startX,startY, pointX,pointY);
          hiddenMiddle.addColorStop(0.1, color);
          hiddenMiddle.addColorStop(0.25, "rgba(0,0,0,0)");
          hiddenMiddle.addColorStop(0.8, "rgba(0,0,0,0)");
          hiddenMiddle.addColorStop(0.9, color);
          ctx.strokeStyle = hiddenMiddle;
      } else {
          ctx.strokeStyle = color;
      }
      ctx.beginPath(); if (pattern) ctx.setLineDash(pattern); ctx.lineWidth = 4;
        ctx.moveTo(startX, startY);
        ctx.lineTo(pointX, pointY);
      ctx.stroke();
    ctx.restore();
};

// Wormholes

var ourWormholes = [];

function processWormholes() {
    ourWormholes = vgap.wormholes ? mergeWormholeEntryAndExit(vgap.wormholes) : [];  // older games lack this field in historical turns
}

mergeWormholeEntryAndExit = function(wormholes) {
    result = [];
    wormholes.forEach(function(wormhole) {
        var m = wormhole.name.match(/^(.*) (\d+)/);
        if (m) {
            var id = Number.parseInt(m[2]);
            var ours = result[id] || { id: id, name: m[1], stability: wormhole.stability, turn: wormhole.turn };
            var seenEntry = false,
                seenExit = false;

            if (wormhole.x != 0 && wormhole.y != 0) {
                seenEntry = true;
                var entry = { x: wormhole.x, y:wormhole.y };
                if (areEqual(ours.exit, entry)) {
                    ours.endpoints = [entry];
                    delete ours.exit;
                    if (ours.entry) {
                        ours.endpoints[1] = ours.entry;
                        delete ours.entry;
                    }
                } else if (ours.endpoints) {
                    if (!areEqual(ours.endpoints[0], entry)) ours.endpoints[1] = entry;
                } else {
                    ours.entry = entry;
                }
            }

            if (wormhole.targetx != 0 && wormhole.targety != 0) {
                seenExit = true;
                var exit = { x: wormhole.targetx, y:wormhole.targety };
                if (areEqual(ours.entry, exit)) {
                    ours.endpoints = [exit];
                    delete ours.entry;
                    if (ours.exit) {
                        ours.endpoints[1] = ours.exit;
                        delete ours.exit;
                    }
                } else if (ours.endpoints) {
                    if (!areEqual(ours.endpoints[0], exit)) ours.endpoints[1] = exit;
                } else {
                    ours.exit = exit;
                }
            }
            if (seenEntry && seenExit) ours.travelled = true;
            result[id] = ours;
        }
    });
    return result.filter(function(ours) { return ours; });
}

function areEqual(loc1, loc2) {
    if (!loc1 && loc2) return false;
    if (loc1 && !loc2) return false;
    return loc1.x == loc2.x && loc1.y == loc2.y;
}

function drawWormholeInfo() {
    ourWormholes.forEach(function(wormhole) {
        if (wormhole.entry) {
            drawWormholeEndpoint(wormhole, wormhole.entry);
        } else if (wormhole.exit) {
            drawWormholeEndpoint(wormhole, wormhole.exit);
        } else {
            wormhole.endpoints.forEach(function(endpoint) {
                drawWormholeEndpoint(wormhole, endpoint);
            });
            if (wormhole.endpoints[1] && !wormhole.travelled) {
                redrawAndFilter.drawLine(vgap.map.screenX(wormhole.endpoints[0].x), vgap.map.screenY(wormhole.endpoints[0].y),
                                         vgap.map.screenX(wormhole.endpoints[1].x), vgap.map.screenY(wormhole.endpoints[1].y),
                                         "grey", [3, 6, 9, 6]
                                        );
            }
        }
    });
}

function drawWormholeEndpoint(wormhole, endpoint) {
    McN_Tk.drawMapCircle(endpoint.x, endpoint.y, 2, "grey");
    var text = wormhole.id+"@("+endpoint.x+","+endpoint.y+")S"+wormhole.stability;
    if (wormhole.turn < vgap.game.turn) text += "T" + wormhole.turn;
    McN_Tk.drawNonoverlappingText(endpoint.x, endpoint.y, text, " grey");
}


// Arc code came from elsewhere, hence no tests :(

function coverAllBothWays(nebulas) {
    nebulas.map(function(n) { n.arcs = [ { angle1: -Math.PI, angle2: Math.PI } ] });
    nebulas.map(function(cover) {
        nebulas.map(function(nebula) {
            coverOne(cover, nebula);
        });
    });
}

function coverOne(cover, nebula) {
    var dx = nebula.x - cover.x,
        dy = nebula.y - cover.y,
        dr = nebula.radius - cover.radius,
        rPlusR = nebula.radius + cover.radius;

    if ((dx*dx + dy*dy <= dr*dr) && nebula.radius < cover.radius) {
        // covers entire nebula
        nebula.arcs = [];
    } else if (dx*dx + dy*dy >= rPlusR*rPlusR) {
        // no cover at all
    } else if (dx == 0 && dy == 0 && dr == 0)  {
        // same thing
    } else {
        cutArcs(cover, nebula);
    }
}

function cutArcs(cover, nebula) {
    var intersection = computeIntersectionPoints(cover, nebula),
        a1 = Math.atan2(intersection.y1-nebula.y, intersection.x1-nebula.x),
        a2 = Math.atan2(intersection.y2-nebula.y, intersection.x2-nebula.x);

    if (a1 < a2) {
        nebula.arcs = [].concat.apply([], nebula.arcs.map(function(arc) { return cutArc(cover, a1, a2, nebula, arc); }));
    } else {
        nebula.arcs = [].concat.apply([], nebula.arcs.map(function(arc) { return cutArc(cover, a2, a1, nebula, arc); }));
    }
}

function computeIntersectionPoints(c1, c2) {
    var dx = c1.x - c2.x,
        dy = c1.y - c2.y,
        dr = c1.radius - c2.radius,
        cc = c1.x*c1.x - c2.x*c2.x + c1.y*c1.y - c2.y*c2.y - c1.radius*c1.radius + c2.radius*c2.radius;

    if (Math.abs(dx) >= Math.abs(dy)) {
        var a = dy*dy/dx/dx + 1,
            b = -dy*cc/dx/dx + 2*dy*c1.x/dx - 2*c1.y,
            c = cc*cc/dx/dx/4 - cc*c1.x/dx + c1.x*c1.x + c1.y*c1.y - c1.radius*c1.radius,

            discr = b*b - 4*a*c,  // must be >0, as the circles intersect at two points; floating point may still break things
            y1 = (-b + Math.sqrt(discr)) / 2 / a,
            x1 = (y1 * 2 * dy - cc) / -2 / dx,  // fill in on line
            y2 = (-b - Math.sqrt(discr)) / 2 / a,
            x2 = (y2 * 2 * dy - cc) / -2 / dx;

        return { x1: x1, y1: y1, x2: x2, y2: y2 };
    } else {
        // same as above, x and y role switched
        var a = dx*dx/dy/dy + 1,
            b = -dx*cc/dy/dy + 2*dx*c1.y/dy - 2*c1.x,
            c = cc*cc/dy/dy/4 - cc*c1.y/dy + c1.y*c1.y + c1.x*c1.x - c1.radius*c1.radius,
            discr = b*b - 4*a*c,
            x1 = (-b + Math.sqrt(discr))/2/a,
            y1 = (x1 * 2 * dx - cc) / -2 / dy,
            x2 = (-b - Math.sqrt(discr)) / 2 / a,
            y2 = (x2 * 2 * dx - cc) / -2 / dy;

        return { x1: x1, y1: y1, x2: x2, y2: y2 };
    }
}

function cutArc(cover, a1, a2, nebula, arc) {
    if (insideCircle(cover, pointAtAngle(nebula, arc.angle1))) {
        if (insideCircle(cover, pointAtAngle(nebula, arc.angle2))) {
            if (a1 > arc.angle1 && a2 < arc.angle2)
                return [ { angle1: a1, angle2: a2 } ];
            else
                return [];
        } else {
            if (a2 > arc.angle2)
                return [ { angle1: a1, angle2: arc.angle2 } ];
            else
                return [ { angle1: a2, angle2: arc.angle2 } ];
        }
    } else {
        if (insideCircle(cover, pointAtAngle(nebula, arc.angle2))) {
            if (a1 < arc.angle1)
                return [ { angle1: arc.angle1, angle2: a2 } ];
            else
                return [ { angle1: arc.angle1, angle2: a1 } ];
        } else {
            if (a1 > arc.angle1 && a2 < arc.angle2)
                return [ { angle1: arc.angle1, angle2: a1 }, { angle1: a2, angle2: arc.angle2 } ];
            else
                return [ { angle1: arc.angle1, angle2: arc.angle2 } ];
        }
    }
}

function pointAtAngle(nebula, angle) {
    return {
        x: nebula.x + Math.cos(angle) * nebula.radius,
        y: nebula.y + Math.sin(angle) * nebula.radius
    }
}

function insideCircle(cover, point) {
    var dx = point.x - cover.x;
    var dy = point.y - cover.y;

    return dx * dx + dy * dy <= cover.radius * cover.radius;
}

// Plugin

redrawAndFilter.loadmap = function() {
    redrawAndFilter.initialize();

    if (McN_Tk.onMobile()) {
        $('div[title="Resources"]').remove();
    } else {
        $("#MapTools li:contains('Neutronium')").remove();
        $("#MapTools li:contains('Duranium')").remove();
        $("#MapTools li:contains('Tritanium')").remove();
        $("#MapTools li:contains('Molybdenum')").remove();
        $("#MapTools li:contains('Supplies')").remove();
        $("#MapTools li:contains('Megacredits')").remove();
        $("#MapTools li:contains('Colonists')").remove();
        $("#MapTools li:contains('Natives')").remove();
    }
};

redrawAndFilter.ownShipRadius = function() {
    return redrawAndFilter.settings.planetRadius() + 2;
};

redrawAndFilter.shipRadius = function() {
    return redrawAndFilter.settings.planetRadius() + 3.5;
};

redrawAndFilter.enemyShipRadius = function() {
    return redrawAndFilter.settings.planetRadius() + 5;
};

redrawAndFilter.starbaseRadius = function() {
    return redrawAndFilter.settings.planetRadius() + 8;
};

redrawAndFilter.loaddashboard = function() {
    vgap.dash.addLeftMenuItem("Redraw &amp; Filter »", redrawAndFilter.showSettings, $("#DashboardMenu").find("ul:eq(3)"));
    $("#GameTitle").append(" - " + vgap.game.shortdescription);
};

redrawAndFilter.showsummary = function() {
    var iconHtml = vgap.dash.getHome.apply(vgap.dash, [redrawAndFilter.showSettings, "settings", "Redraw &amp; Filter"]);
    if (McN_Tk.onMobile()) {
        $("#TurnSummary").append(iconHtml);
    } else {
        $("#TurnSummary").find("ul").append(iconHtml);
    }
};

redrawAndFilter.showSettings = function() {
    vgap.dash.content.empty();
    $("<h2>Redraw &amp; Filter Settings</h2>").appendTo(vgap.dash.content);

    var browserSettingsMsg = redrawAndFilter.settings.mayUseLocalStorage() ?
        "<p>All settings are automatically saved when changed.</p>" :
        "<div style='color: orange;'>It seems you have a disabled localStorage. Try to enable it (Firefox requires you to accept cookies to do so; setting an exception for planets.nu seems to work). Once enabled, your local/browser settings will be retained after page reload (and when not clearing cookies when quiting your browser, your settings will be retained after browser restart). Your settings-stored-per-game are saved already.</div>";
    $(browserSettingsMsg).appendTo(vgap.dash.content);

    $("<h3>Setting stored locally, in the browser, for all of your games.</h3>").appendTo(vgap.dash.content);
    var f = function(r, rName) {
        if (!rName) rName = r;
        var checked = (r == redrawAndFilter.settings.planetRadius() ? " checked" : "");
        return "<input "+checked+" type='radio' name='planetRadius' onclick='vgap.plugins[\""+name+"\"].settings.setPlanetRadius("+r+"); vgap.map.draw();'>"+rName+"</input>";
    };
    var html = "<div>Planet Radius: " + f(3) + f(4.5) + f(6) + f(12, 'Glyn') + "</div>";
    $(html).appendTo(vgap.dash.content);
};

redrawAndFilter.processload = function() {
    filterEverything();

    processIonstorms();
    processNebulas(vgap.nebulas);
    findTinyMinefields();
    processWormholes();
}

redrawAndFilter.isInReplay = false;
redrawAndFilter.replaystart = function() { redrawAndFilter.isInReplay = true; }
redrawAndFilter.replayend = function() { redrawAndFilter.isInReplay = false; }

vgap.registerPlugin(redrawAndFilter, name);
console.log(name+" v"+version+" planets.nu plugin registered");

var head = document.getElementsByTagName('head')[0];
if (head) {
    var newCss = document.createElement('style');
    newCss.type = "text/css";
    newCss.innerHTML = "#PlanetsMapContainer { background-image: none; }" +  // remove starmap background
        ".esimplewin { max-width: 95%; } ";  // desktop popup
    head.appendChild(newCss);
}
