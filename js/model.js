var ns = {};
(function model(){
    var SHAPES = {
            square : 1,
            circle : 2
        },
        tooltip = {
            show : function(x, y, text){
                $("#tooltip").text(text).show().css({
                    top: y + "px",
                    left: x + "px"
                });
            },
            hide : function(){
                $("#tooltip").hide();
            }
        },
        /**
         * HTML Canvas wrapper
         */
        MyCanvas = Backbone.GSModel.extend({
            defaults : {
                fillStyle : "#0aa",
                baseScale : 10,
                zoomFactor : 2,
                x : 0,
                y : 0
            },
            getters : {
                oCanvas : function getObjectiveCanvas(){
                    if(this.attributes.oCanvas){
                        return this.attributes.oCanvas;
                    }
                    return this.set("oCanvas", oCanvas.create({
                        canvas: "#main",
                        background: "#222"
                    })).get("oCanvas");
                }
            },
            toCanvasUnits : function toCanvasUnits(value){
                return value * this.get("zoomFactor") * this.get("baseScale");
            },
            toVenueUnits : function toVenueUints(value){
                return value / (this.get("zoomFactor") * this.get("baseScale"));
            },
            moveTop : function moveTop(t){
                this.set("y", this.get("y") + t);
            },
            moveLeft : function moveLeft(l){
                this.set("x", this.get("x") + l);
            },
            draw : function draw(shapeProperties){
                var canvas = this.get("oCanvas"),
                    tcu = function(u){
                        return this.toCanvasUnits(u);
                    }.bind(this),
                    shapeConf,
                    shape;

                if(shapeProperties.shape === SHAPES.square){
                    _.expected(shapeProperties.size.w, "when drawing a square width is expected");
                    _.expected(shapeProperties.size.h, "when drawing a square height is expected");
                    shapeConf = {
                        x: tcu(this.get("x")),
                        y: tcu(this.get("y")),
                        width: tcu(shapeProperties.size.w),
                        height: tcu(shapeProperties.size.h),
                        fill: shapeProperties.fillStyle || this.get("fillStyle")
                    };
                    shape = canvas.display.rectangle(shapeConf);
                    canvas.addChild(shape, false);
                }else if(shapeProperties.shape === SHAPES.circle){
                    _.expected(shapeProperties.size.r, "when drawing a circle radius is expected");
                    shapeConf = {
                        x: tcu(this.get("x")),
                        y: tcu(this.get("y")),
                        radius: tcu(shapeProperties.size.r - 0.05),
                        fill: shapeProperties.fillStyle || this.get("fillStyle")
                    };
                    shape = canvas.display.ellipse(shapeConf);
                    canvas.addChild(shape);
                }
                _.log(shapeConf);

                _.each(shapeProperties.eventHandlers, function(eh, key){
                    shape.bind(key, eh);
                });

                return shape;
            },
            redraw : function(){
                this.get("oCanvas").redraw();
            },
            addText : function(ob, text, props){
                var oCanvas = this.get("oCanvas"),
                    textOb;

                ob = ob || oCanvas;

                textOb = oCanvas.display.text(_.extend({
                    x: ob.width / 2,
                    y: ob.height / 2,
                    origin: { x: "center", y: "center"},
                    align: "center",
                    font: "bold 25px sans-serif",
                    text: text,
                    fill: "#fff"
                }, props));
                ob.addChild(textOb);
            }
        }),
        /**
         * Zone is an area on the venue
         */
        Zone = Backbone.GSModel.extend({
            defaults : {
                /**
                 * @type {Backbone.Collection}
                 */
                subZones : null,
                /**
                 * the rotation of the zone, 0 means it is facing the front of the parent zone, 90 it is at the left
                 * of it and -90 at the right, and so on
                 * @type {Number}
                 */
                rotation: 0,
                /**
                 * @type {Number}
                 */
                width: null,
                /**
                 * @type {Number}
                 */
                height: null,
                /**
                 * @type {Number}
                 */
                top: 0,
                /**
                 * @type {Number}
                 */
                left: 0,
                /**
                 * Parent optional parent zone
                 * @type {Zone}
                 */
                parent: null,
                /**
                 * @type {MyCanvas}
                 */
                myCanvas : null

            },
            getters : {
                /**
                 * Calculates the size of the current zone, the basic case is just the width + height, but it tries to
                 * be smart and get each of the sub-zones dimensions when not empty
                 * @returns {{w: Number, h: Number}}
                 */
                width : function getMaxWidth(){
                    var sz = this.get("subZones");
                    return (sz && sz.length) ? _.max(sz, function returnMax(zone){
                        return zone.get("size").w;
                    }).get("size").w : this.attributes.width;
                },
                height : function getMaxHeight(){
                    var sz = this.get("subZones");
                    return (sz && sz.length) ? _.max(sz, function returnMax(zone){
                        return zone.get("size").h;
                    }).get("size").h : this.attributes.height;
                },
                size : function getSize(){
                    return {
                        w : this.get("width"),
                        h : this.get("height")
                    };
                },
                /**
                 * Calculates the absolute position of this zone based on the parent position
                 * @returns {{l : Number, t : Number}}
                 */
                absolutePosition : function getAbsolutePosition(){
                    if(this.get("parent")){
                        return {
                            l : this.get("parent").get("absolutePosition").l + this.get("left"),
                            t : this.get("parent").get("absolutePosition").t + this.get("top")
                        };
                    }
                    return {l : this.get("left"), t : this.get("top")};
                },
                /**
                 * Gets the canvas that will be used to draw this zone
                 * @returns {MyCanvas}
                 */
                canvas : function getCanvas(){
                    if(!this.myCanvas) {
                        this.myCanvas = this.get("parent") ? this.get("parent").get("canvas") : new MyCanvas();
                    }
                    return this.myCanvas;
                },
                drawProperties : function getDrawProperties(){
                    var props = {
                        shape : SHAPES.square,
                        size : this.get("size")
                    };
                    if(this.get("fillStyle")){
                        props.fillStyle = this.get("fillStyle");
                    }
                    return props;
                }
            },
            preDraw : function(canvas){
                var cp = this.get("absolutePosition");
                canvas.set("x", cp.l);
                canvas.set("y", cp.t);
            },
            /**
             * the basic zone shape is a rectangle, for more specialized drawings this method needs to me overridden
             */
            draw : function draw(){
                var canvas = this.get("canvas"),
                    ob;
                this.preDraw(canvas);
                ob = canvas.draw(this.get("drawProperties"));
                this.postDraw(canvas, ob);
                this.set("shape", ob);
                return ob;
            },
            postDraw : function postDraw(canvas, ob){
                if(this.get("name")){
                    canvas.addText(ob, this.get("name"));
                }
            },
            initialize: function initializeVenue() {
                var sz = this.get("subZones"),
                    initSZ = [],
                    Cls;
                _.each(sz, function(zone){
                    zone.parent = this;
                    Cls = zone.zoneType ? mainZones[zone.zoneType] : this.get("defaultZoneType");
                    initSZ.push(new Cls(zone));
                }.bind(this));
                this.set("subZones", initSZ);
            }
        }),
        mainZones = {};
        /**
         * Seat represents a seat on a venue zone,
         * for simplicity the standard measuring unit is one seat
         */
        mainZones.Seat = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                width : 1,
                height : 1,
                reserved : false,
                reservedFillStyle : "#A00",
                mineFillStyle : "#AA0",
                mine : false
            }),
            getters : _.extend(_.clone(Zone.prototype.getters), {
                displayName : function(){
                    return this.get("parent").get("parent").get("name") +
                        "-" + this.get("parent").get("name") +
                        this.get("pos");
                },
                drawProperties : function getDrawProperties(){
                    var seat = this,
                        props = {
                        shape: SHAPES.circle,
                        size: {r: Math.max(this.get("width"), this.get("height")) / 2},
                        eventHandlers: {
                            mouseenter: function () {
                                tooltip.show(this.x, this.y, seat.get("displayName"));
                            },
                            mouseleave: function () {
                                tooltip.hide();
                            },
                            click: function () {
                                var mod = true;
                                if(seat.get("mine")){
                                    seat.set("mine", false);
                                }else if(seat.get("reserved")){
                                    mod = false;
                                    window.alert("Already Taken");
                                }else{
                                    seat.set("mine", true);
                                }

                                if(mod){
                                    seat.reDraw();
                                }
                            }
                        }
                    };
                    if(this.get("fillStyle")){
                        props.fillStyle = this.get("fillStyle");
                    }
                    if(this.get("reserved")){
                        props.fillStyle = this.get("reservedFillStyle");
                    }
                    if(this.get("mine")){
                        props.fillStyle = this.get("mineFillStyle");
                    }
                    return props;
                }
            }),
            reDraw : function reDraw(){
                var canvas = this.get("canvas");

                canvas.set("x", canvas.toVenueUnits(this.get("shape").x));
                canvas.set("y", canvas.toVenueUnits(this.get("shape").y));

                this.draw();
            },
            preDraw : function preDraw(){}
        });
        /**
         * Collection of seats
         */
        mainZones.Row = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                defaultZoneType : mainZones.Seat
            }),
            draw : function drawRow(){
                var sz = this.get("subZones"),
                    canvas = this.get("canvas");
                _.each(sz, function(seat){
                    seat.draw();
                    canvas.moveLeft(seat.get("width"));
                }.bind(this));
            }
        });
        /**
         * Collection of seat rows
         */
        mainZones.SeatsZone = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                name : "SeatsZone",
                defaultZoneType : mainZones.Row
            }),
            draw : function drawSeatsZone(){
                var cp = this.get("absolutePosition"),
                    sz = this.get("subZones"),
                    canvas = this.get("canvas");

                canvas.set("x", cp.l);
                canvas.set("y", cp.t);

                _.each(sz, function(row){
                    row.draw();
                    //reset x position
                    canvas.set("x", cp.l);
                    canvas.moveTop(row.get("height"));
                }.bind(this));
            }
        });

        /**
         * Stage is a special type of zone where the performer plays
         */
        mainZones.Stage = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                name : "Stage",
                width : 50,
                height : 20
            })
        });

        /**
         * General admission zone
         */
        mainZones.GAZone = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                name: "GA",
                width : 50,
                height : 50,
                capacity : 500,
                used : 50
            })
        });

        /**
         * Venue is a collection of zones
         * */
        ns.Venue = Zone.extend({
            defaults : _.extend(_.clone(Zone.prototype.defaults), {
                name: "Venue"
            }),
            draw : function drawSeatsZone(){
                _.each(this.get("subZones"), function(zone){
                    zone.draw();
                }.bind(this));
                this.get("canvas").redraw();
            }

        });
})();

var rowsSectionHeight = 5,
    rowsSectionWidth = 10,
    scenarioHeight = 7,
    scenarioWidth = 22,
    hallwaySize = 1,
    randomBool = function(){
        return Math.random() >= 0.6;
    },
    getRow = function(){
        var res = [];
        for(var i = 1; i <= rowsSectionWidth; i++){
            res.push(
                {
                    reserved: randomBool(),
                    pos : i
                }
            );
        }
        return res;
    },
    getRows = function(){
        var res = [];
        for(var i = 1; i <= rowsSectionHeight; i++){
            res.push(
                {
                    name : i,
                    subZones : getRow()
                }
            );
        }
        return res;
    },
    chart = {
        load : function(){
            this.i = (new ns.Venue({
                subZones: [
                    {
                        name : "Stage",
                        zoneType: "Stage",
                        left : hallwaySize,
                        top : hallwaySize,
                        height : scenarioHeight,
                        width: scenarioWidth,
                        fillStyle : "rgb(45, 86, 87)"
                    },
                    {
                        name : "A",
                        zoneType: "SeatsZone",
                        left : (2 * hallwaySize),
                        top : scenarioHeight + (2 * hallwaySize),
                        subZones: getRows()
                    },
                    {
                        name : "B",
                        zoneType: "SeatsZone",
                        left : rowsSectionWidth + (3 * hallwaySize),
                        top : scenarioHeight + (2 * hallwaySize),
                        subZones: getRows()
                    },
                    {
                        name : "C",
                        zoneType: "SeatsZone",
                        left : (2 * hallwaySize),
                        top :  scenarioHeight + rowsSectionHeight + (3 * hallwaySize),
                        subZones: getRows()
                    },
                    {
                        name : "D",
                        zoneType: "SeatsZone",
                        left : rowsSectionWidth + (3 * hallwaySize),
                        top : scenarioHeight + rowsSectionHeight + (3 * hallwaySize),
                        subZones: getRows()
                    }
                ]
            }));
        },
        render : function(){
            this.i.draw();
        }
    };


chart.load();
chart.render();

