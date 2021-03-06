var express = require('express');
var app = express();
var https = require('https');
var fs = require('fs');
var bodyParser = require('body-parser');
var ejs = require('ejs');
//global variables
var formattedjson;
var settings_jira_host;
//var for column names; allows for easier column addition but jsonformat still needs to be edited
var col_names = ["id", "ch_id", "rfc_name", "description", "state", "priority", "impdate", "assignee", "effort", "print"];
//set view engine to ejs
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static('public'));

//send CSS for global html formatting
app.get('/globalstyle.css', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/globalstyle.css");
})

//send jquery-ui
app.get('/jquery-ui.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/jquery-ui-1.12.1/jquery-ui.js");
})

//send jquery.min
app.get('/jquery.min.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/node_modules/jquery/dist/jquery.min.js");
})

//send jquery-ui css
app.get('/jquery-ui.css', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/jquery-ui-1.12.1/jquery-ui.css");
})

//send jquery-ui-1.12.1 css
app.get('/jquery-ui.min.css', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/jquery-ui-1.12.1/jquery-ui.min.css");
})

//send jquery.js
app.get('/jquery.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/node_modules/jquery/dist/jquery.js");
})

//send jquery-ui.min.js
app.get('/jquery-ui.min.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/jquery-ui-1.12.1/jquery-ui.min.js");
})

//send tabulator css file
app.get('/tabulator.css', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/tabulator-master/tabulator.css");
})

//send tabulator js file
app.get('/tabulator.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/tabulator-master/tabulator.js");
})

//send ejs js file
app.get('/ejs.js', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/" + "ejs.js");
})

//send home/landing page to user
app.get('/', function(req, res) {
    //send homepage
    res.sendFile(__dirname + "/" + "homepage.html");
})

app.post('/refreshdata', function(req, res){
    //if the table gets edited, the refreshed data is posted here
    response = {
        jsonbody: req.body["jsonrefresh"]
    }
    //console.log(response["jsonbody"])
    //replace the old data with the refreshed data
    formattedjson = response["jsonbody"];
})

//page for printing
app.get('/printpage', function(req, res) {
    //res.end(JSON.stringify(formattedjson));
    //send the JSON along with the table ejs

    res.render('printable.ejs', {jsondata: formattedjson, columns: {col: col_names}});
})

//request the page
app.post('/response', function(req, res, next) {

    //get information from user submission
    response = {
        username: req.body.user_query,
        password: req.body.pw_query,
        project_key: req.body.pk_query,
        date_range_1: req.body.daterange_query_1,
        date_range_2: req.body.daterange_query_2,
        is_requested: req.body.requested_query
    };

    //specify host/path/user + jql for JIRA API
    var options = {
        host: settings_jira_host,
        path: "/rest/api/2/search?jql=issuetype%20=%20Change%20AND%20project=" + response["project_key"],
        auth: response["username"] + ":" + response["password"]
    };

    //if the user wants to restrict the status to requested only
    if (response["is_requested"]) {
        options["path"] += "%20AND%20status=requested";
    }

    //if the user defines a date range for both
    if (response["date_range_1"] != "" && response["date_range_2"] != "" ){
        options["path"] += '%20AND%20created%20>%3D%20' + encodeURI(response["date_range_1"]) +'%20AND%20created%20<%3D%20' + encodeURI(response["date_range_2"]);
    } else if (response["date_range_1"] != "" && response["date_range_2"] == "" ){ //if the first query is not empty
        options["path"] += '%20AND%20created%20>%3D%20' + encodeURI(response["date_range_1"]) ;
    } else if (response["date_range_1"] == "" && response["date_range_2"] != "" ){ //if the second query is not empty
        options["path"] += '%20AND%20created%20<%3D%20' + encodeURI(response["date_range_2"]) ;
    } else { //if both are empty
        //do nothing
    }





    //callback function -  executed during https.get
    callback = function(response) {
        var body = '';
        //another chunk of data has been recieved, so append it to `body`
        response.on('data', function(chunk) {
            body += chunk;
        })

        //the whole response has been recieved
        console.log("Response recieved, connection successful.");

        response.on('end', function() {
            console.log("Processing recieved body.");
            //try parsing the response; catch any errors
            try {
                var parsedbody = JSON.parse(body)
            } catch (err) {
                //if there is an error, print error to console and user and stop execution
                errormessage = "JSON.parse error: " + err
                console.log(errormessage);
                res.send(errormessage + "Check that the user information or URL is valid.");
                return;
            }
            //process the parsed json into a properly formatted json for Tabulator
            formattedjson = jsonformat(parsedbody)
            console.log("Body processed. Sending data.");
            //send the JSON along with the table ejs
            res.render('index.ejs', {
                jsondata: formattedjson
            });
            console.log("Data sent successfully.")
        })
    }

    //perform GET request catch any errors and print them
    https.get(options, callback).on('error', (err) => {
            console.log(err);
            res.send(err);
        });;


})

//function that takes the JIRA JSON, then takes and formats the data for the table
function jsonformat(inputjson) {
    //create new list for final json output
    var outputjson = [];
    //loop for all issues
    for (i = 0; i < inputjson["issues"].length; i++) {
        //create a new array for current i
        outputjson.push({});
        //add id to current array
        outputjson[i][col_names[0]] = i;
        //add change id to current array
        outputjson[i][col_names[1]] = "<b>" + inputjson["issues"][i]["key"] + "</b";
        //add rfc_name to current array
        outputjson[i][col_names[2]] = '<center><div valign="top">' + inputjson["issues"][i]["fields"]["summary"] + "</div></center>";
        //add description fields to current array
        outputjson[i][col_names[3]] = "";
        for (x = 0; x <= 8; x++) {
            //if the field isn't empty
            if (inputjson["issues"][i]["fields"]["customfield_1040" + x] != null) {
                //add the appropriate decription name for each description entry. ie 10402 us Business Impact
                if (x == 0) {
                    var desc_name = "<b>Business Objective and Rationale: </b>"
                } else if (x == 1) {
                    var desc_name = "<b>Business Requirements: </b>"
                } else if (x == 2) {
                    var desc_name = "<b>Business Impact: </b>"
                } else if (x == 3) {
                    var desc_name = "<b>End User Impact: </b>"
                } else if (x == 4) {
                    var desc_name = "<b>Business/User Impact If Change Is Not Done: </b>"
                } else if (x == 5) {
                    var desc_name = "<b>Risk Assessment: </b>"
                } else if (x == 6) {
                    var desc_name = "<b>Solution: </b>"
                } else if (x == 8) {
                    var desc_name = "<b>Benefits: </b>"
                }
                //add the formatted decription to the array
                outputjson[i]["description"] += desc_name + inputjson["issues"][i]["fields"]["customfield_1040" + x] + "\n";
            }
        }
        //add the description as the description if it is not empty
        if (inputjson["issues"][i]["fields"]["description"] != null) {
            //add the formatted decription to the array
            outputjson[i]["description"] += " Description: " + inputjson["issues"][i]["fields"]["description"] + "\n";
        }
        //add state to current array
        outputjson[i][col_names[4]] = inputjson["issues"][i]["fields"]["status"]["name"];
        //add priority to current array
        outputjson[i][col_names[5]] = inputjson["issues"][i]["fields"]["priority"]["name"];
        //add reporter to current array
        if (inputjson["issues"][i]["fields"]["duedate"] != null) {
            outputjson[i][col_names[6]] = inputjson["issues"][i]["fields"]["duedate"];
        } else {
            outputjson[i][col_names[6]] = "N/A";
        }
        //add assignee to current array if an assignee exists
        if (inputjson["issues"][i]["fields"]["assignee"] != null) {
            outputjson[i][col_names[7]] = inputjson["issues"][i]["fields"]["assignee"]["displayName"];
        } else {
            outputjson[i][col_names[7]] = "N/A";
        }
        //add the amount of effort/cost (estimate days * 900) if an estimation exists
        if (inputjson["issues"][i]["fields"]["customfield_10506"] != null){
            outputjson[i][col_names[8]] = "$ " + parseFloat(inputjson["issues"][i]["fields"]["customfield_10506"]) * 900;
        } else {
            outputjson[i][col_names[8]] = "N/A";
        }
        //set default print value to true
        outputjson[i][col_names[9]] = "true";

    }
    return outputjson;
}


//load server-config.json to get setting for port
fs.readFile('server-conf.json', 'utf8', function(err, data){
    if (err) {
        console.log("Configuration file server-conf.json' not found. Using default port 8081.");
        //var settings_port = "8081";
    } else {
        try {
            var parsedsettings = JSON.parse(data)
            var settings_port = parsedsettings["port"];
            settings_jira_host = parsedsettings["jira_host"];
        } catch (err) {
            //if there is an error, print error to console and user and stop execution
            errormessage = "JSON.parse error: " + err + "; Check that the given information or port is valid.";
            console.log(errormessage);
        }
        
    } 
    //start server at given port
    var server = app.listen(settings_port, function() {
        var host = server.address().address
        var port = server.address().port
            //print to console server address and port
        console.log("Server listening at http://%s:%s", host, port);

    })
});