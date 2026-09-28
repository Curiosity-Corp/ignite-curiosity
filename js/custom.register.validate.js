validate.validators.optionalFormat = function (value, options) {
    if (validate.isEmpty(value)) {
        return null;
    }

    var pattern = options.pattern instanceof RegExp ? options.pattern : new RegExp(options.pattern, options.flags);
    return pattern.test(value) ? null : options.message;
};

//constraints which are applied on the form field
let constraints = {
    Prefix: {
        length: {
            minimum: 1,
            maximum: 15
        }
    },
    Display_Name: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        },
        format: {
            pattern: "^(?!admin$)(?!moderator$)(?!user$)(?!guest$)(?!anonymous$)(?!^[0-9 .'\-]+$)(?!^[A-Za-z]$)^[A-Za-z0-9 .'\-]{2,50}$",
            flags: "iu",
            message: "^Please enter a valid display name (2-50 characters: letters, numbers, spaces, . ' -)"
        }
    },
    First_Name: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        },
        format: {
            pattern: "^(?!admin$)(?!moderator$)(?!user$)(?!guest$)(?!anonymous$)(?!^[0-9 .'\-]+$)^[A-Za-z][A-Za-z .'\-]*$",
            flags: "iu",
            message: "^Please enter a valid first name (letters, spaces, . ' - only)"
        }
    },
    Last_Name: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        }
    },
    Email: {
        presence: true,
        email: true
    },
    Phone_Number: {
        presence: true,
        format: {
            pattern: "[0-9]+",
            message: "^can only contain digits"
        }
    },
    Birth_Date: {
        presence: true,
        format: {
            // This pattern checks for a date in mm/dd/yyyy format with basic validation for month and day ranges.
            pattern: "^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/(19|20)\\d{2}$",
            message: "^must be in mm/dd/yyyy format"
        }
    },
    Gender:{
        presence:true,
        inclusion:["Male", "Female", "Other"]
    },
    Driver_License: {
        presence: true,
        inclusion: ["Yes", "No"]
    },
    Backgound_Check: {
        presence: true,
        inclusion: ["Yes", "No"]
    },
    Drug_Test: {
        presence: true,
        inclusion: ["Yes", "No"]
    },
    GitHub_Username: {
        presence: {
            message: '^You must have a GitHub Username'
        },   
        format:{
            pattern:"^[a-zA-Z0-9-]+$",
            message:"^must be a valid GitHub username (only alphanumeric characters and hyphens allowed)"
        }
    },
    LinkedIn_Username:{
        presence:true,
        format:{
            pattern:"^[a-zA-Z0-9-]+$",
            message:"^must be a valid LinkedIn username (only alphanumeric characters and hyphens allowed)"
        }
    },
    MS_Learn_Username:{
        presence: {
            message: '^You must have a Microsoft Learn Profile'
        },   
         format:{
             pattern:"^[a-zA-Z0-9-]+$",
             message:"^must be a valid Microsoft Learn username"
         }
     },
     Resume:{
         url:true
     },
     SMILE_Space:{ // Assuming 'SMILE_Space' is the correct name attribute for the SMILE Space™ field.
         presence:true
     },
    //  Intro_Video:{
    //      url:true,
    //      presence: {
    //          message:"^must be a valid Flip Grid Intro Video"
    //      }
    //  },
     Prev_Salary:{  
        presence: {
            message: '^Salary must be present. If you do not have one, just put 0'
        },     
        numericality:{  
            onlyInteger:false, // Allow decimal for salary  
            greaterThanOrEqualTo:0 // Salary must be non-negative  
        }  
    },
    Education_Level:{
        // Current education level constraints already defined in initial constraints variable.
    },
    Time_Interest: {
        // Assuming 'Time_Interest' is the correct name attribute for Type of Curiosity checkboxes.
        presence: true,
        inclusion: {
            within: ["Intensive", "Flexible", "Part Time", "Full Time", "Live In"],
            message: "^You must select at least one desired time."
        }
    },
    // speedTestResult is intentionally NOT a blocking constraint: the speed
    // test is optional (non-blocking warning only, see handleFormSubmit).
    Currency:{  
            presence:true
    },
    USDT:{
        optionalFormat:{
            pattern:"^0x[a-fA-F0-9]{40}$",   
            message:"^must be a valid USDT address"   
        }
    },
    Binance_Pay_ID:{
        optionalFormat:{
            pattern:"^[0-9]{9}$",   
            message:"^must be a valid Binance Pay ID"   
        }
    },        
    Reference:{    
        presence:false // Optional field but if provided, ensure it's not empty.    
    },
    Invite_Code: {
        presence: {
            message: "^Invitation code is required - finish the free orientation at curiosityhive.org or ask an existing member for a code"
        },
    },
    
    Address: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 100
        }
    },
    City: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 100
        }
    },
    Location: {
        presence: true
    },
    Zip_Code: {
        presence: true
    },
    Education_Level:{
        presence: true
    },
    Program_Interest: {
        presence: {
            message: "^You must select at least one interest"
        }
    },
    Time_Interest: {
        presence: {
            message: '^Time Commitment is required'
        }
    },
    Message:{
        presence: true,
        length: {
            minimum: 10,
            maximum: 1500
        }
    },
    Correspondence_Accept:{
        presence: {
            message: "^You need to check the checkbox"
        },
        inclusion: {
            within: [true],
            message: "^You need to check the checkbox"
        }
    },
    Understand_Days:{
        presence: {
            message: "^You need to check the checkbox"
        },
        inclusion: {
            within: [true],
            message: "^You need to check the checkbox"
        }
    },
    Policy_Terms:{
        presence: {
            message: "^You need to check the checkbox"
        },
        inclusion: {
            within: [true],
            message: "^You need to check the checkbox"
        }
    }
};

var inputs = document.querySelectorAll("form#registerForm input.form-control, textarea, select.form-control");
inputs.forEach(input => {
    input.addEventListener("change", function (ev) {
        var errors = validate(form, constraints) || {};
        showErrorsForInput(this, errors[this.name])
    });
}
)


var form = document.querySelector("form#registerForm");
form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    handleFormSubmit(form);
});

//it handles the form submit
function handleFormSubmit(form, input) {
    var errors = validate(form, constraints);
    // then we update the form to reflect the results
    showErrors(form, errors || {});
    if (!errors) {
        // Speed test is optional and non-blocking: surface a gentle notice
        // when no result was recorded, but always allow submission.
        try {
            var speedInput = document.getElementById('speedTestResult');
            var statusDiv = document.getElementById('speedTestStatus');
            var speedVal = speedInput ? parseFloat(speedInput.value) : NaN;
            if ((!speedVal || speedVal <= 0) && statusDiv) {
                statusDiv.innerHTML = 'Note: no speed test recorded - you can still submit. Running the optional check above helps coaches advise on connectivity.';
                statusDiv.className = 'speed-test-note';
            }
            var legacyGate = document.getElementById('speed-test-error');
            if (legacyGate) {
                legacyGate.style.display = 'none';
                legacyGate.textContent = '';
            }
        } catch (warnErr) {
            console.log('optional speed-test notice skipped', warnErr);
        }
        showSuccess();
    } else {
        // console log the errors
        console.log(errors);
        formError();
        submitMSG(false, "Did you fill in the form properly?");
    }
}


function showErrors(form, errors) {
    // We loop through all the inputs and show the errors for that input
    form.querySelectorAll("input.form-control, select.form-control, textarea").forEach(function (input) {
        showErrorsForInput(input, errors && errors[input.name]);
    });
}

function showErrorsForInput(input, errors) {
    var formGroup = closestParent(input, "form-group")
    resetFormGroup(formGroup);
    console.log(input, errors)
    if (errors) {
        formGroup.classList.add("has-error");
        errors.forEach(function (error) {
            addError(formGroup, error);
        });
    } else {
        formGroup.classList.add("has-success");
    }
}

// Recusively finds the closest parent that has the specified class
function closestParent(child, className) {
    if (!child || child == document) {
        return null;
    }
    if (child.classList.contains(className)) {
        return child;
    } else {
        return closestParent(child.parentNode, className);
    }
}

// function to remove errors from the form
function resetFormGroup(formGroup) {
    formGroup.classList.remove("has-error");
    formGroup.classList.remove("has-success");
    formGroup.querySelectorAll(".custom-error").forEach(function (el) {
        el.remove();
    });
}

//logic to add error into the form
function addError(formGroup, error) {
    let errorMessage = document.createElement('small');
    errorMessage.style.position = 'absolute';
    errorMessage.style.color = '#ea205a';
    errorMessage.innerText = error;
    errorMessage.classList.add('custom-error');
    let isSelect = formGroup.querySelector('.tg-select');
    if (isSelect) {
        errorMessage.classList.add('select')
        isSelect.appendChild(errorMessage);
    } else {
        formGroup.appendChild(errorMessage);
    }
}

//function to reset the form
function resetForm() {
    document.querySelectorAll('div.form-group.has-success').forEach(formGroup => {
        formGroup.classList.remove('has-success');
    })
    document.querySelectorAll('#registerForm input.form-control, select.form-control, textarea').forEach(input => {
        input.value = '';
    })
}


// Show a clear, non-silent error when bot verification cannot run.
function showRecaptchaError(msg) {
    submitMSG(false, msg);
    try {
        if (typeof Swal !== 'undefined' && Swal && Swal.fire) {
            Swal.fire({
                title: 'Verification failed',
                html: msg,
                type: 'error',
                confirmButtonText: 'OK'
            });
        } else if (typeof swal !== 'undefined' && swal && swal.fire) {
            swal.fire({
                title: 'Verification failed',
                type: 'error',
                confirmButtonText: 'Ok'
            });
        }
    } catch (alertErr) {
        console.log('alert fallback failed', alertErr);
    }
}

function showAlertSuccess() {
    var html = 'Thank you! Your registration was <strong>received</strong> and is now ' +
        '<strong>pending coach approval</strong>. This is <strong>not</strong> an instant account.<br><br>' +
        'A coach will review your application. Watch your email (and Spam!) for login details.<br>' +
        'Then, login to the Welcome Group.';
    try {
        if (typeof Swal !== 'undefined' && Swal && Swal.fire) {
            Swal.fire({
                title: 'Registration received - pending coach approval',
                type: 'success',
                html: html,
                showCloseButton: true,
                focusConfirm: false,
                confirmButtonText: '<a style="color: white" href="start.html"><i class="fa fa-address-card"></i> OK</a>'
            });
            return;
        }
    } catch (alertErr) {
        console.log('success alert failed', alertErr);
    }
    try {
        if (typeof Swal === 'function') {
            Swal({
                title: '<strong>Registration received - pending coach approval</strong>',
                type: 'success',
                html: html,
                showCloseButton: true,
                focusConfirm: false,
                confirmButtonText: '<a style="color: white" href="start.html"><i class="fa fa-address-card"></i> OK</a>'
            });
        }
    } catch (legacyErr) {
        console.log('legacy alert failed', legacyErr);
    }
}

function showAlertError(title) {
    try {
        if (typeof Swal !== 'undefined' && Swal && Swal.fire) {
            Swal.fire({
                title: title,
                type: 'error',
                confirmButtonText: 'Ok'
            });
            return;
        }
    } catch (alertErr) {
        console.log('error alert failed', alertErr);
    }
    try {
        if (typeof swal !== 'undefined' && swal && swal.fire) {
            swal.fire({
                title: title,
                type: 'error',
                confirmButtonText: 'Ok'
            });
        }
    } catch (legacyErr) {
        console.log('legacy error alert failed', legacyErr);
    }
}

// this function handles success if form is valid
function showSuccess() {
    submitMSG(true, 'Submitting... please wait.');
    var tokenInput = document.querySelector('input[name=token]');
    var recaptchaInput = document.getElementById('recaptchaResponse');

    function doSubmit(token) {
        if (!token) {
            showRecaptchaError('Verification failed - please disable any ad blocker, reload the page, and retry.');
            return;
        }
        if (tokenInput) {
            tokenInput.value = token;
        }
        if (recaptchaInput) {
            recaptchaInput.value = token;
        }
        let a = $('form#registerForm');
        $.ajax({
            type: a.attr('method'),
            url: a.attr('action'),
            data: a.serialize(),
            success: function (data, textStatus, xhr) {
                console.log(xhr.status)
                if (xhr.status === 200) {
                    showAlertSuccess();
                    submitMSG(true, 'Registration received - pending coach approval. Watch your email (and Spam) for next steps.')
                    resetForm();
                } else {
                    showAlertError('Some Error Occurred!');
                }
            },
            error: function (data) {
                showAlertError('An unexpected Error Occurred!');
            },
        })
    }

    try {
        if (typeof grecaptcha === 'undefined' || !grecaptcha || !grecaptcha.execute || !grecaptcha.ready) {
            showRecaptchaError('Verification failed to load (ad blocker or network issue). Please disable your ad blocker, reload the page, and retry.');
            return;
        }
        grecaptcha.ready(function () {
            try {
                grecaptcha.execute("6LcHIYcUAAAAAPnqH0iBwnDeFma0mWAMJKJHAoEO").then(function (token) {
                    doSubmit(token);
                }, function (execErr) {
                    console.log('grecaptcha execute failed', execErr);
                    showRecaptchaError('Verification failed - please disable any ad blocker, reload the page, and retry.');
                });
            } catch (execSyncErr) {
                console.log('grecaptcha execute threw', execSyncErr);
                showRecaptchaError('Verification failed - please disable any ad blocker, reload the page, and retry.');
            }
        });
    } catch (readyErr) {
        console.log('grecaptcha ready failed', readyErr);
        showRecaptchaError('Verification failed - please disable any ad blocker, reload the page, and retry.');
    }
}

function formError() {
    $("#registerForm").removeClass().addClass('shake animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
        $(this).removeClass();
    });
}

function submitMSG(valid, msg) {
    if (valid) {
        var msgClasses = "h3 text-center tada animated text-success";
    } else {
        var msgClasses = "h3 text-center text-danger";
    }
    $("#success").removeClass().addClass(msgClasses).text(msg);
}
