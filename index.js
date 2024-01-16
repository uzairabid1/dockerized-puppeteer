const puppeteer = require('puppeteer')





let categories = ["Meat & Seafood","Fruit & Vegetables","Dairy,Eggs & Fridge","Bakery","Deli","Pantry","Drinks","Frozen","Household","Health & Beauty","Baby","Pet","Liquor"];
let baseUrl = "https://www.coles.com.au/browse";

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
} 

function getCategories(categories){

    let categories_url = [];

    for(let category of categories){
        let new_category = category.toLowerCase().replace(" & ","-").replace(",","-");
        categories_url.push(new_category);
    }
    return categories_url;
}

function getItemContent(itemName) {
    const regex = /(\d+(?:\.\d+)?\s*(?:approx\s*)?(?:pack|g|kg|l|mL|each))/i;

    const match = itemName.match(regex);
  
    if (match) {
        const matchedPart = match[1];
        const restOfString = itemName.replace(match[0], '').trim();
        return { matchedPart, restOfString };
    } else {
        return null;
    }
}

function parseCurrencyToDouble(currencyString) {
    const value = parseFloat(currencyString.replace('$', '').trim());

    if (!isNaN(value)) {
        return value * 2;
    } else {
        return null;
    }
}

function getCurrentDate() {
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0];
    return formattedDate;
}

async function getDetails(browser,baseUrl){
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(function() {
        navigator.geolocation.getCurrentPosition = function (cb) {
          setTimeout(() => {
            cb({
              'coords': {
                accuracy: 21,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: 23.129163,
                longitude: 113.264435,
                speed: null
              }
            })
          }, 1000)
        }
      });
    let resultArray = [];
    let categoriesUrl = getCategories(categories);

    for(let category of categoriesUrl){
        let categoryUrl = baseUrl+`/${category}`;
        await page.goto(categoryUrl, { 'timeout': 100000, 'waitUntil': 'load' });

        while(true){
            await page.waitForXPath("//section[@data-testid='product-tile']/div[@class='product__cta_section']/div[1]/section/div[@class='price']/span[@class='price__value']");
          
            const totalProducts = await page.$x("//section[@data-testid='product-tile']/div[@class='product__cta_section']/div[1]/section/div[@class='price']/span[@class='price__value']");

           
            let product_idx = 0;

            for(const product of totalProducts){
                let data  = {
                    date: "",
                    item_name: "",
                    item_content: "",
                    category_name: "",
                    item_price: 0,
                    per_unit_price: "",
                    comment: null
                }
                let item_price = await page.evaluate(product=>product.textContent.trim(),product);
                let item_per_unit_price_el = await page.$x(`(//section[@data-testid='product-tile'])[${product_idx+1}]/div[@class='product__cta_section']/div[1]/section/div[@class='price__calculation_method']`);
                let item_name_el = await page.$x(`(//section[@data-testid='product-tile'])[${product_idx+1}]/div[2]/header/div[@class='product__message-title_area']/a/h2`)
                let is_special_el = await page.$x(`(//section[@data-testid='product-tile'])[${product_idx+1}]/div[1]`);

                
                item_per_unit_price_el = item_per_unit_price_el[0];
                item_name_el = item_name_el[0];
                is_special_el = is_special_el[0];
                let item_name = '';
                
                let per_unit_price = '';
                try{
                    per_unit_price = await page.evaluate(item_per_unit_price_el=>item_per_unit_price_el.textContent.trim(),item_per_unit_price_el);
                }catch(e){
                    per_unit_price = '';
                }
                try{
                    item_name = await page.evaluate(item_name_el=>item_name_el.textContent.trim(),item_name_el);
                }catch(e){
                    continue
                }
                let is_special = '';
                try{
                    is_special = await page.evaluate(is_special_el=>is_special_el.textContent.trim(),is_special_el);
                }catch(e){
                    is_special = '';
                }


                let date = getCurrentDate();
                item_price = parseCurrencyToDouble(item_price);
                let comment = null;
                if(is_special=='Special'){
                    comment = "Special";
                }
                let item_content = ''
                try{
                    item_content = getItemContent(item_name).matchedPart;
                }catch(e){
                    item_content = ''
                }
                try{
                    item_name = item_name.split(" |")[0];
                }catch(e){
                    item_name = item_name;
                }

                data.date = date;
                data.item_name = item_name;
                data.item_content = item_content;
                data.category_name = category;
                data.item_price = item_price;
                data.per_unit_price = per_unit_price;
                data.comment = comment;
                product_idx++;

                console.log(data);
                resultArray.push(data);
            }

            try{
                const nextButton = await page.$('button#pagination-button-next');
                if(await nextButton.evaluate(nextButton=>nextButton.getAttribute('disabled'))==''){
                    break;
                }
                await nextButton.evaluate(nextButton => nextButton.click());
                await delay(4000);
            }catch(e){
                break;
            }

        }        
    }

    return resultArray;
}



async function main(){
    const browser = await puppeteer.launch({
        headless: 'new',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--no-sandbox',
            '--disable-notifications',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--start-maximized'
        ]  
        });  

    const dataArray = await getDetails(browser,baseUrl); 
    console.log(dataArray);
}

main();