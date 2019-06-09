    
        // While in Development mode, update production variable to the word: Dev
        // Otherwise, change to the word: Live
        // If Bug Testing, update to the word: Bug

        var production = "Dev";
        var theheader = "header_full.html";

    function theheaderfunc() {
        if (production == "Dev") 
            theheader = "_include/header_full.html";
        else if (production == "Bug")
            theheader = "_include/header_bug.html";
        else
           theheader = "_include/header_min.html";

        return theheader;
    }
    
$(function(){  $("#header").load(theheaderfunc());  });


    

