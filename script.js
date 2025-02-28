let pdfDoc = null; // Global variable to hold the PDF document
let currentPage = 1; // Track the current page
let currentZoom = 1.0; // Track the current zoom level
let docsMap = new Map();
let isRendering = false; 

$(document).ready(async function() {
    // Fetch the list of documents when the page loads
    await fetchDocuments();

    async function fetchDocuments() {
        const documentsList = $('#documents');
        const responseDisplay = $('#responseDisplay');
        const sourceInfo = $('#sourceInfo');
        documentsList.empty(); // Clear any existing documents
        let data = null;
    
        try {
            toggleLoadingIndicator(true);
            const response = await fetch('https://fairlane-189762133025.us-central1.run.app/get_docs');
            // const response = await fetch('http://127.0.0.1:8000/get_docs');
            if (!response.ok) {
                throw new Error('Failed to fetch documents');
            }
            data = await response.json();
    
            // Populate the document list
            const documentPromises = data.source_docs.map(async (doc) => {
                const response = await fetch(doc.url); // Assuming you have a URL to fetch from
                const blob = await response.blob();
                const reader = new FileReader();
                var base64data = '';
                reader.onloadend = () => {
                    base64data = reader.result.split(',')[1];
                    docsMap.set(doc.name, {url: doc.url, base64data: base64data});
                    reader.abort();
                };
                reader.readAsDataURL(blob); 
    
                const listItem = $('<li></li>')
                .on('click', function() {
                    responseDisplay.html(''); // Clear previous response
                    sourceInfo.hide(); // Hide the source link
                    // get_pdf_contents(doc.name).then(contents => {
                    //     loadPDF("data:text/plain;base64," + contents); // Load the PDF when clicked
                    // });
                    loadPDF(atob(docsMap.get(doc.name).base64data));
                });
                const iconDiv = $('<div></div>')
    
                const iconLink = $('<a></a>')
                .attr('href', '#') // Set the URL to the document
                .attr('target', '_blank') // Open in a new tab
                .html('<i class="fa fa-external-link"></i>')
                .on('click', function(event) {
                    event.stopPropagation(); // Prevent the click event from bubbling up to the list item
                    
                    const base64data = docsMap.get(doc.name).base64data; // Get Base64 data from the map
                    if (base64data) {
                        const byteCharacters = atob(base64data); // Decode Base64 to binary string
                        const byteNumbers = new Uint8Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const blob = new Blob([byteNumbers], { type: 'application/pdf' }); // Create a Blob
                        const blobUrl = URL.createObjectURL(blob); // Create a URL for the Blob
    
                        window.open(blobUrl); // Open the Blob URL in a new tab
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 100); // Clean up the Blob URL after 100ms
                    } else {
                        console.error('No Base64 data found for the document.');
                    }
                });
    
                const linkDiv = $('<div></div>')
    
                const link = $('<a></a>')
                .attr('href','#') 
                    .text(doc.name);
    
                iconDiv.append(iconLink);
                linkDiv.append(link);
                listItem.append(iconDiv);
                listItem.append(linkDiv);
                
                documentsList.append(listItem);
                docsMap.set(doc.name, {url: doc.url});
            });
    
            await Promise.all(documentPromises);
        } catch (error) {
            documentsList.html(`<li>Error: ${error.message}</li>`);
        } finally {
            toggleLoadingIndicator(false);
        }
    }

    $('#submitButton').on('click', async function() {
        const query = $('#queryInput').val();
        const userId = '12345'; // Replace with the actual user ID or retrieve it dynamically
        const responseDisplay = $('#responseDisplay');
        const sourceInfo = $('#sourceInfo');
        const filenameDisplay = $('#filename');
        const pageNumberDisplay = $('#pageNumber');

        // Clear previous response
        responseDisplay.html('');   
        sourceInfo.hide(); // Hide the source link initially
        toggleLoadingIndicator(true);

    // Call your AI assistant API (replace 'YOUR_API_ENDPOINT' with your actual endpoint)
    try {
        const response = await fetch('https://fairlane-189762133025.us-central1.run.app/query/?query=' + query, {
        // const response = await fetch('http://127.0.0.1:8000/query/?query=' + query, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            responseDisplay.html(`<h4>Response</h4><p>${data.answer}</p>`); // Display the AI response

            // Check if metadata is provided in the response
            if (data.metadata) {
                filenameDisplay.text(data.metadata.filename); 
                pageNumberDisplay.text(data.metadata.page_number); 
                sourceInfo.show(); 

                // Load the PDF and navigate to the specified page
                // get_pdf_contents(data.metadata.filename).then(contents => {
                //     loadPDF("data:text/plain;base64," + contents, data.metadata.page_number); 
                // });
                loadPDF(atob(docsMap.get(data.metadata.filename).base64data), data.metadata.page_number);
                $('#queryInput').val('');
            }
        } catch (error) {
            responseDisplay.html(`<p>Error: ${error.message}</p>`);
        } finally {
            toggleLoadingIndicator(false);
        }
    });
});

function toggleLoadingIndicator(show) {
    const loadingIndicator = $('#loadingIndicator');
    if (show) {
        loadingIndicator.show();
        $('body').addClass('disabled'); 
    } else {
        loadingIndicator.hide();
        $('body').removeClass('disabled'); 
    }
}

async function get_pdf_contents(filename) {
    const response = await fetch('https://fairlane-189762133025.us-central1.run.app/get_pdf/?filename=' + filename);
    // const response = await fetch('http://127.0.0.1:8000/get_pdf/?filename=' + filename);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
   
    return data;
}

// Function to load and render the PDF
async function loadPDF(pdfPath, pageNum=1) {
    console.log('Loading PDF from path:', pdfPath); // Log the path
    const pdfCanvas = $('#pdfCanvas')[0];
    const pdfViewer = $('#pdfViewer');
    pdfViewer.show(); // Show the PDF viewer

    // Clear the canvas before loading a new PDF
    const context = pdfCanvas.getContext('2d');
    context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

    toggleLoadingIndicator(true); // Show the loading indicator before starting to load the PDF
    const loadingTask = pdfjsLib.getDocument({data: pdfPath});
    loadingTask.promise.then(pdf => {
        pdfDoc = pdf; // Store the PDF document
        currentPage = pageNum; // Set the current page to the specified page number

        // Check if the requested page number is valid
        if (currentPage < 1 || currentPage > pdfDoc.numPages) {
            throw new Error(`Invalid page request: ${currentPage}`);
        }

        renderPage(currentPage); // Render the specified page
        toggleLoadingIndicator(false);
    }).catch(error => {
        console.error('Error loading PDF: ', error);
    });
}

// Function to render a specific page
function renderPage(pageNum) {
    pdfDoc.getPage(pageNum).then(page => {
        const pdfCanvas = $('#pdfCanvas')[0];
        const viewerWidth = $('#pdfViewer').width(); 
        const viewerHeight = $('#pdfViewer').height(); 
        const viewport = page.getViewport({ scale: 1 }); 

        const scale = currentZoom; //Math.min(viewerWidth / viewport.width, viewerHeight / viewport.height) * currentZoom;

        const scaledViewport = page.getViewport({ scale: scale }); 
        pdfCanvas.width = scaledViewport.width; 
        pdfCanvas.height = scaledViewport.height; 

        const renderContext = {
            canvasContext: pdfCanvas.getContext('2d'),
            viewport: scaledViewport
        };
        page.render(renderContext);
        $('#currentPage').text(pageNum); // Update the current page display
        $('#currentZoom').text(Math.round(currentZoom * 100) + '%'); // Update the zoom level display
        $('#pageInput').val(pageNum); 
    });
}

// Event listeners for page navigation
$('#prevPage').on('click', function() {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
});

$('#nextPage').on('click', function() {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
        currentPage++;
        renderPage(currentPage);
    }
});

// Event listeners for zoom controls
$('#zoomIn').on('click', function() {
    currentZoom += 0.1; // Increase zoom level
    renderPage(currentPage); // Re-render the current page with the new zoom level
});

$('#zoomOut').on('click', function() {
    if (currentZoom > 0.1) { // Prevent zooming out too much
        currentZoom -= 0.1; // Decrease zoom level
        renderPage(currentPage); // Re-render the current page with the new zoom level
    }
});

// Initialize the slider and set the current zoom level
$('#zoomSlider').on('input', function() {
    currentZoom = parseFloat($(this).val()); // Get the value from the slider
    $('#currentZoom').text(Math.round(currentZoom * 100) + '%'); // Update the zoom level display
    renderPage(currentPage); // Re-render the current page with the new zoom level
});

$('#goToPage').on('click', function() {
    const pageNum = parseInt($('#pageInput').val(), 10); // Get the page number from the input
    if (pageNum >= 1 && pageNum <= pdfDoc.numPages) { // Check if the page number is valid
        currentPage = pageNum; // Set the current page
        renderPage(currentPage); // Render the specified page
    } else {
        currentPage = pdfDoc.numPages; // Set the current page
        renderPage(currentPage);
    }
});