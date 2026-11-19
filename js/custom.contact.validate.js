//constraints which are applied on the form field
let constraints = {
    name: {
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
};

var inputs = document.querySelectorAll("form#contactForm input.form-control, textarea, select.form-control");
inputs.forEach(input => {
    input.addEventListener("change", function (ev) {
        var errors = validate(form, constraints) || {};
        showErrorsForInput(this, errors[this.name])
    });
}
)


var form = document.querySelector("form#contactForm");
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
    document.querySelectorAll('#contactForm input.form-control, select.form-control, textarea').forEach(input => {
        input.value = '';
    })
}


// this function handles success if form is valid
function showSuccess() {
    grecaptcha.ready(function () {
        grecaptcha.execute("6LcHIYcUAAAAAPnqH0iBwnDeFma0mWAMJKJHAoEO").then(function (token) {
            document.querySelector('input[name=token]').value = token;
            let a = $('form#contactForm');
            $.ajax({
                type: a.attr('method'),
                url: a.attr('action'),
                data: a.serialize(),
                timeout: 30000,
                success: function (data, textStatus, xhr) {
                    console.log(xhr.status)
                    if (xhr.status === 200) {
                        swal.fire({
                            title: "Thank You!",
                            type: "success",
                            confirmButtonText: 'Ok'
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
                error: function (xhr, textStatus) {
                    // Say what went wrong and what helps, instead of one message for everything.
                    var code = '';
                    try { code = (JSON.parse((xhr && xhr.responseText) || '{}') || {}).code || ''; } catch (parseErr) {}
                    var title = 'Your message was not sent';
                    var text = 'The contact service answered with an error (HTTP ' + (xhr ? xhr.status : 'unknown') + '). Please wait a minute and send again.';
                    if (code === 'not_human') {
                        text = 'Our security check could not confirm this browser. Turn off any VPN, ad blocker or privacy extension, or try another browser or your phone, then send again.';
                    } else if (!xhr || xhr.status === 0 || textStatus === 'timeout') {
                        text = 'We could not reach the contact service. Check your connection and send again.';
                    }
                    console.log('[contactSubmit] ' + (code || textStatus || 'error') + ' status=' + (xhr ? xhr.status : 'unknown'));
                    submitMSG(false, text);
                    swal.fire({
                        title: title,
                        text: text,
                        type: "error",
                        confirmButtonText: 'Ok'
                    })
                },
            })
        });
    });
}

function formError() {
    $("#contactForm").removeClass().addClass('shake animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
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