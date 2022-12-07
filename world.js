function onQuestionChanged() {
  var select = d3.select('#questionSelect').node();
  var question_selection = select.options[select.selectedIndex].value;
  // If the question is the same, do nothing
  if (question_selection == question) {
    return;
  }

  // When selecting a new question, clear the stat boxes
  question = question_selection;
  laststatbox = 1;
  clearStatBox();
  laststatbox = 2;
  clearStatBox();

  // Change the question caption
  changeQuestionCaption(question);

  // Redraw the map
  drawCountries(question_selection);
}

const yes_color = "#349C55";
const no_color = "#1668BD";
const dont_know_color = "#FFB318";

const outline_color = "#1668BD";

// Saves the SVG element
var svg = d3.select("svg"),
  width = svg.attr("width"),
  height = +svg.attr("height");

// Map and projection
var path = d3.geoPath();
var projection = d3.geoMercator()
  .scale(330)
  .center([0,20])
  .translate([width / 10, height * 1.1]);

// Topo is the external map data
var topo = null;
var error = null;

// Stores the last stat box used to
//    ensure that we are alternating between the two
var laststatbox = null;

// The question we are currently displaying
var question = "Is there a law forbidding sexual orientation discrimination for job applicants?";

// Keeps track of the total number of "yes" and "no" answers for each country.
// Used initially to calculate the averages for each country and question
var country_question_yes_sum = d3.map();
var country_question_yes_count = d3.map();
var country_question_no_sum = d3.map();
var country_question_no_count = d3.map();

// Keeps a list of all the questions for the dropdown menu
var questions = [];

// Set of countries to ensure we don't draw other countries on the map
var country_set = new Set();
var colorScale = d3.scaleThreshold()
  .domain([35, 40, 45, 50, 55, 60, 65, 70, 75])
  .range(d3.schemeBlues[9]);

// Stores the average of the total number of "yes" and "no" answers for each country
// Country -> Average
// Country -> Average
// ... etc
var data_total_yes = d3.map();
var data_total_no = d3.map();

// Map to store the average of the total number of "yes" and "no" answers for each country, seperated by question
// Country -> Question -> Average
//         -> Question -> Average
//         -> Question -> Average
// Country -> Question -> Average
//         -> Question -> Average
// ... etc
var country_question_yes_average = d3.map();
var country_question_no_average = d3.map();


/*********************************************************
 **                                                     **
 **       Data Loading and Filtering                    **
 **                                                     **
 *********************************************************/
d3.queue()
  .defer(d3.json, "https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson")
  .defer(d3.csv, "LGBTRights_ByCountryEurope_postoncanvas.csv", function(csv) {
    let temp = {};
    temp.Country = csv.Country;
    temp.Subset = csv.Subset;
    temp.Question = csv.ShortenedQuestion;
    temp.ShortName = csv.ShortName;
    temp.Answer = csv.Answer;
    temp.Percent = csv.Percentage;

    if (temp.Answer == "Yes" && !isNaN(temp.Percent)) {
      if (!country_question_yes_sum.has(temp.Country)) {
        country_question_yes_sum.set(temp.Country, d3.map());
        country_question_yes_count.set(temp.Country, d3.map());
      }
  
      if (!country_question_yes_sum.get(temp.Country).has(temp.Question)) {
        country_question_yes_sum.get(temp.Country).set(temp.Question, 0);
        country_question_yes_count.get(temp.Country).set(temp.Question, 0);
      }

      country_question_yes_sum.get(temp.Country).set(temp.Question, country_question_yes_sum.get(temp.Country).get(temp.Question) + Number(temp.Percent));
      country_question_yes_count.get(temp.Country).set(temp.Question, country_question_yes_count.get(temp.Country).get(temp.Question) + 1);
    } else if (temp.Answer == "No" && !isNaN(temp.Percent)) {
      if (!country_question_no_sum.has(temp.Country)) {
        country_question_no_sum.set(temp.Country, d3.map());
        country_question_no_count.set(temp.Country, d3.map());
      }
  
      if (!country_question_no_sum.get(temp.Country).has(temp.Question)) {
        country_question_no_sum.get(temp.Country).set(temp.Question, 0);
        country_question_no_count.get(temp.Country).set(temp.Question, 0);
      }

      country_question_no_sum.get(temp.Country).set(temp.Question, country_question_no_sum.get(temp.Country).get(temp.Question) + Number(temp.Percent));
      country_question_no_count.get(temp.Country).set(temp.Question, country_question_no_count.get(temp.Country).get(temp.Question) + 1);
    }

    if (questions.indexOf(temp.Question) == -1) {
      questions.push(temp.Question);
    }

    country_set.add(temp.Country);
  })
  .await(ready);

function filterData() {
  country_set.forEach(function(country) {
    let yes_sum = 0;
    let yes_count = 0;
    let no_sum = 0;
    let no_count = 0;

    questions.forEach(function(question) {
      if (country_question_yes_sum.has(country) && country_question_yes_sum.get(country).has(question)) {
        yes_sum += country_question_yes_sum.get(country).get(question);
        yes_count += country_question_yes_count.get(country).get(question);
      }

      if (country_question_no_sum.has(country) && country_question_no_sum.get(country).has(question)) {
        no_sum += country_question_no_sum.get(country).get(question);
        no_count += country_question_no_count.get(country).get(question);
      }

      if (!country_question_yes_average.has(country)) {
        country_question_yes_average.set(country, d3.map());
        country_question_no_average.set(country, d3.map());
      }

      country_question_yes_average.get(country).set(question, yes_sum / yes_count);
      country_question_no_average.get(country).set(question, no_sum / no_count);
    });

    let yes_avg = yes_sum / yes_count;
    let no_avg = no_sum / no_count;

    data_total_yes.set(country, yes_avg);
    data_total_no.set(country, no_avg);
  });
}

function ready(error1, topo1) {
    error = error1;
    topo = topo1;

    filterData();
    
    drawCountries("Is there a law forbidding sexual orientation discrimination for job applicants?", error, topo);
    changeQuestionCaption("Is there a law forbidding sexual orientation discrimination for job applicants?");
}

/*********************************************************
 **                                                     **
 **       Map Functionality                             **
 **                                                     **
 *********************************************************/
function drawCountries(question) {
  svg.append("g")
    .selectAll("path")
    .data(topo.features)
    .enter()
    .append("path")
    .filter(function(d) {
      return country_set.has(d.properties.NAME);
    })
      // draw each country
      .attr("d", d3.geoPath()
        .projection(projection)
      )
      // set the color of each country
      .attr("fill", function (d) {
        if (question == "All") {
          d.total = data_total_yes.get(d.properties.NAME) || 0;
          if (d.total == 0) {
            return "transparent";
          }
          return colorScale(d.total);
        }
        else {
          d.total = country_question_yes_average.get(d.properties.NAME).get(question) || 0;
          if (d.total == 0) {
            return "transparent";
          }
          return colorScale(d.total);
        }
      })
      .style("stroke", function(d) {
        if (question == "All") {
          d.total = data_total_yes.get(d.properties.NAME) || 0;
          if (d.total == 0) {
            return "transparent";
          }
          return "grey";
        }
        else {
          d.total = country_question_yes_average.get(d.properties.NAME).get(question) || 0;
          if (d.total == 0) {
            return "transparent";
          }
          return "grey";
        }
      })
      .attr("class", function(d){ return "Country" } )
      .style("opacity", .8)
      .on("mouseover", mouseOver)
      .on("mouseleave", mouseLeave)
      .on("click", mouseClick);
}

var mouseOver = function(d) {
  d3.selectAll(".Country")
    .transition()
    .duration(0)
    .style("opacity", .5)
  d3.select(this)
    .transition()
    .duration(0)
    .style("opacity", 1)
    .style("stroke", "black")
  // Display country name in box to right
  let group = d3.select("svg")
    .append("g")
    .attr("id", "country_name_box_group");

  group.attr("transform", "translate(10,20)");

  group.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("width", 200)
    .attr("height", 25)
    .attr("fill", "white")
    .attr("stroke", outline_color)
    .attr("stroke-width", 1);
  let curr_percent = question == "All" ? Math.round(data_total_yes.get(d.properties.NAME) * 100) / 100 : Math.round(country_question_yes_average.get(d.properties.NAME).get(question) * 100) / 100;
  let extra_text = question == "All" ? curr_percent + "% Yes" : curr_percent + "% Yes";
  group.append("text")
    .attr("x", 100)
    .attr("y", 17)
    .attr("text-anchor", "middle")
    .text(d.properties.NAME + ": " + extra_text)
    .attr("font-size", "15px")
    .attr("font-family", "sans-serif")
    .attr("fill", outline_color);

}

var mouseLeave = function(d) {
  d3.selectAll(".Country")
    .transition()
    .duration(0)
    .style("opacity", .8)
  d3.select(this)
    .transition()
    .duration(0)
    .style("stroke", function(d) {
      d.total = data_total_yes.get(d.properties.NAME) || 0;
      if (d.total == 0) {
        return "transparent";
      }
      return "grey";
    })

  d3.select("#country_name_box_group").remove();
}

var mouseClick = function(d) {
  clearStatBox();
  populateStatBox(d);
}



/*********************************************************
 **                                                     **
 **       Stat / Comparison Boxes                       **
 **                                                     **
 *********************************************************/
var statbox1 = svg.append("g")
 .attr("class", "statbox1")
 .attr("transform", "translate(0,40)");

statbox1.append("rect")
 .attr("x", 0)
 .attr("y", 0)
 .attr("rx", 10)
 .attr("ry", 10)
 .attr("width", 200)
 .attr("height", 250)
 .attr("fill", "transparent")
 .attr("stroke", outline_color)
 .attr("stroke-width", 1);

// Move the statbox to the right underneath the legend
statbox1.attr("transform", "translate(400, 90)");

var statbox2 = svg.append("g")
 .attr("class", "statbox2")
 .attr("transform", "translate(0,40)");

// Add outline rectangle for statbox
statbox2.append("rect")
 .attr("x", 0)
 .attr("y", 0)
 .attr("rx", 10)
 .attr("ry", 10)
 .attr("width", 200)
 .attr("height", 250)
 .attr("fill", "transparent")
 .attr("stroke", outline_color)
 .attr("stroke-width", 1);

statbox2.attr("transform", "translate(620, 90)");

function drawPieChart(x, y, yes_percent, no_percent, unknown_percent, group, country) {

  group.append("text")
    .attr("x", x)
    .attr("y", y - 85)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", outline_color)
    .text(country);

  if (question == "All") {
    group.append("text")
      .attr("x", x)
      .attr("y", y - 70)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text("(Average of All Questions)");
  }

  var radius = 60;
  var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.value; });

  var arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  var data = [
    { "name": "Yes", "value": yes_percent },
    { "name": "No", "value": no_percent },
    { "name": "Unknown", "value": unknown_percent }
  ];

  var arcs = group.selectAll("arc")
    .data(pie(data))
    .enter()
    .append("g")
    .attr("class", "arc")
    .attr("transform", "translate(" + x + "," + y + ")");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", function(d) {
      if (d.data.name == "Yes") {
        return yes_color;
      } else if (d.data.name == "No") {
        return no_color;
      } else {
        return dont_know_color;
      }
    });

  group.append("text")
    .attr("x", x - 30)
    .attr("y", y + 90)
    .attr("text-anchor", "left")
    .attr("font-size", "12px")
    .text("Yes: " + Math.round(yes_percent * 100) / 100 + "%");

  group.append("text")
    .attr("x", x - 30)
    .attr("y", y + 105)
    .attr("text-anchor", "left")
    .attr("font-size", "12px")
    .text("No: " + Math.round(no_percent * 100) / 100 + "%");
    
  group.append("text")
    .attr("x", x - 30)
    .attr("y", y + 120)
    .attr("text-anchor", "left")
    .attr("font-size", "12px")
    .text("Don't know: " + Math.round(unknown_percent * 100) / 100 + "%");


  // Append a rectangle before each text
  group.append("rect")
    .attr("x", x - 45)
    .attr("y", y + 81)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", yes_color);

  group.append("rect")
    .attr("x", x - 45)
    .attr("y", y + 96)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", no_color);

  group.append("rect")
    .attr("x", x - 45)
    .attr("y", y + 111)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", dont_know_color);
}

function clearStatBox() {
  let id = laststatbox == 1 ? 2 : 1
  svg.select(".statbox" + id).remove();

  var statbox = svg.append("g")
    .attr("class", "statbox" + id)
    .attr("transform", "translate(0,40)");

  // Add outline rectangle for statbox
  statbox.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 200)
    .attr("height", 250)
    .attr("rx", 10)
    .attr("ry", 10)
    .attr("fill", "transparent")
    .attr("stroke", outline_color)
    .attr("stroke-width", 1);

  if (id == 1) {
    statbox.attr("transform", "translate(400, 90)");
  } else {
    statbox.attr("transform", "translate(620, 90)");
  }
}

function populateStatBox(d) {
  let id = laststatbox == 1 ? 2 : 1;

  let statbox = d3.select(".statbox" + id);
  if (question == "All") {
    drawPieChart(100, 110, data_total_yes.get(d.properties.NAME), data_total_no.get(d.properties.NAME), 100 - (data_total_yes.get(d.properties.NAME) + data_total_no.get(d.properties.NAME)), statbox, d.properties.NAME);
  } else {
    drawPieChart(100, 110, country_question_yes_average.get(d.properties.NAME).get(question), country_question_no_average.get(d.properties.NAME).get(question), 100 - (country_question_yes_average.get(d.properties.NAME).get(question) + country_question_no_average.get(d.properties.NAME).get(question)), statbox, d.properties.NAME);
  }

  laststatbox = id;
}


/*********************************************************
 **                                                     **
 **      Legend and Question Statement                  **
 **                                                     **
 *********************************************************/
var x = d3.scaleLinear()
  .domain([30, 70])
  .rangeRound([400, 660]);

var g = svg.append("g")
  .attr("class", "key")
  .attr("transform", "translate(0,40)");

g.selectAll("rect")
  .data(colorScale.range().map(function(d) {
    d = colorScale.invertExtent(d);
    if (d[0] == null) d[0] = x.domain()[0];
    if (d[1] == null) d[1] = x.domain()[1];
    return d;
  }))
  .enter().append("rect")
    .attr("height", 8)
    .attr("x", function(d) { return x(d[0]); })
    .attr("width", function(d) { return x(d[1]) - x(d[0]); })
    .attr("fill", function(d) { return colorScale(d[0]); });

g.append("text")
  .attr("class", "caption")
  .attr("x", x.range()[0])
  .attr("y", -6)
  .attr("fill", "#000")
  .attr("text-anchor", "start")
  .attr("font-weight", "bold")
  .text("Percentage of 'Yes' Answers to Question from Country's LGBT Population");

g.call(d3.axisBottom(x)
    .tickSize(13)
    .tickFormat(function(x, i) { return x; })
    .tickValues(colorScale.domain()))
  .select(".domain")
    .remove();

function changeQuestionCaption(question) {
  svg.select(".questioncaption").remove();

  if (question == "All") {
    question = "Average of All Questions";
  }

  g.append("text")
    .attr("class", "questioncaption")
    .attr("x", x.range()[0])
    .attr("y", -21)
    .attr("fill", "#0a4a90")
    .attr("text-anchor", "start")
    .attr("font-weight", "bold")
    .attr("font-size", "12px")
    .text(question);
}