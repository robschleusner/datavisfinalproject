var width = 500;
var height = 500;

d3.csv("LGBTRights_ByCountryEurope_postoncanvas.csv", function(csv) {
  for (var i = 0; i < csv.length; ++i) {
    csv[i].Country = Number(csv[i].Country)
    csv[i].Subset = Number(csv[i].Subset);
    csv[i].Question = Number(csv[i].ShortenedQuestion);
    csv[i].ShortName = Number(csv[i].ShortName);
    csv[i].Answer = Number(csv[i].Answer);
    csv[i].Percent = Number(csv[i].Percent);
  }
});
