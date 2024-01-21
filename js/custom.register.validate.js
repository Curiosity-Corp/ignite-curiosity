//constraints which are applied on the form field
let constraints = {
    invitecode: {
        presence: true,
    },
    preferredname: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        },
        format: {
            pattern: "^(?!.*\\b(hafiz|hafis|hafith|hafez|hafizh|hafiza|hafeza|hafize|hafisah|hafeesah|hafizeh|haphiza|haphizeh|mme|hajji|hajiya|syed|syeda|mr|mrs|miss|ms|dr|prof|sir|lady|lord|mister|master|madam|mian|begum|chaudhry|malik|nawab|sardar|pir|mohamed|mohamad|mahammad|mohammed|mohammad|muhamad|muhammed|muhammad|mohmad|m)\\b)(?!admin$)(?!moderator$)(?!user$)(?!guest$)(?!anonymous$)(?!^[0-9]+$)(?!^[a-zA-Z]$)^.{5,}[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$",
            flags: "iu",
            message: "Error or Too Common. Choose a Unique Name"
        }
        
    },
    firstname: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        },
        format: {
            pattern: "^(?!.*\\b(hafiz|hafis|hafith|hafez|hafizh|hafiza|hafeza|hafize|hafisah|hafeesah|hafizeh|haphiza|haphizeh|mme|hajji|hajiya|syed|syeda|mr|mrs|miss|ms|dr|prof|sir|lady|lord|mister|master|madam|mian|begum|chaudhry|malik|nawab|sardar|pir|m)\\b)(?!admin$)(?!moderator$)(?!user$)(?!guest$)(?!anonymous$)(?!^[0-9]+$)(?!^[a-zA-Z]$)^.{5,}[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$",
            flags: "iu",
            message: "Contains Invalid Characters or Prefix"
        }
    },
    lastname: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 50
        }
    },
    email: {
        presence: true,
        email: true
    },
    tel: {
        presence: true,
        format: {
            pattern: "[0-9]+",
            message: "can only contain digits"
        }
    },
    birthdate: {
        presence: true,
        format: {
            // This pattern checks for a date in mm/dd/yyyy format with basic validation for month and day ranges.
            pattern: "^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/(19|20)\\d{2}$",
            message: "must be in mm/dd/yyyy format"
        }
    },    
    address: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 100
        }
    },
    city: {
        presence: true,
        length: {
            minimum: 2,
            maximum: 100
        }
    },
    location: {
        presence: true
    },
    zipcode: {
        presence: true
    },
    current_education_level:{
        presence: true
    },
    interest: {
        presence: true
    },
    time: {
        presence: {
            message: '^Commitment Desired is required'
        }
    },
    message:{
        presence: true,
        length: {
            minimum: 10,
            maximum: 1500
        }
    },
    
    understand_days:{
        presence: {
            message: "^You need to check the checkbox"
        },
        inclusion: {
            within: [true],
            message: "^You need to check the checkbox"
        }
    },
    policy_terms:{
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
    // validate the form against the constraints
    var errors = validate(form, constraints);
    // then we update the form to reflect the results
    showErrors(form, errors || {});
    if (!errors) {
        showSuccess();
    } else {
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


// this function handles success if form is valid
function showSuccess() {
    grecaptcha.ready(function () {
        grecaptcha.execute("6LcHIYcUAAAAAPnqH0iBwnDeFma0mWAMJKJHAoEO").then(function (token) {
            document.querySelector('input[name=token]').value = token;
            let a = $('form#registerForm');
            submitMSG(true, '')
            $.ajax({
                type: a.attr('method'),
                url: a.attr('action'),
                data: a.serialize(),
                success: function (data, textStatus, xhr) {
                    console.log(xhr.status)
                    if (xhr.status === 200) {
                        
                        Swal({
                            title: '<strong>Registration Successful</strong>',
                            type: 'success',
                            html:
                                'Check email (and Spam!) for Login details.<br>Then, login to the Welcome Group.',
                            showCloseButton: true,
                            focusConfirm: false,
                            confirmButtonText:
                                '<a style="color: white" href="start.html"><i class="fa fa-address-card"></i> OK</a>',
                        });
                        submitMSG(true, 'Thank You! We will reach out to you soon.')
                        resetForm();
                    } else {
                        swal.fire({
                            title: "Some Error Occurred!",
                            type: "error",
                            confirmButtonText: 'Ok'
                        });
                    }
                },
                error: function (data) {
                    swal.fire({
                        title: "An unexpected Error Occurred!",
                        type: "error",
                        confirmButtonText: 'Ok'
                    })
                },
            })
        });
    });
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