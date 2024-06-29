const oneDay = 1*24*60*60*1000
        let today =  new Date().toISOString().split('T')[0] ;//tworzenie obiektu date z dzisiejszą datą
        let minDate = new Date(1009929600000).toISOString().split('T')[0];//tworzenie obiektu date z datą minimalną, 2 stycznia 2002 
        
        
        document.getElementById('endDate').setAttribute("max", today)
        document.getElementById('startDate').setAttribute("max", today)// ustawienie maksymalnej daty na dzisiejszy dzień
        document.getElementById('endDate').setAttribute("min", minDate)
        document.getElementById('startDate').setAttribute("min", minDate)//blokowanie pól wyboru na minm, data podana w dokumentacji API 2 stycznia 2002
        
        document.getElementById('download').addEventListener('click', async function() {
            const StartDateInput = document.getElementById('startDate');// data od której ma się zacząć pobieranie
            const EndDateInput = document.getElementById('endDate');// data na której ma się skończyć pobieranie
            const option = document.querySelector('select').value;// wybór jednej z trzech tabeli: a,b,c
            let StartDate = StartDateInput.value;
            let EndDate = EndDateInput.value;
            //sprawdzanie czy przekazane zakresy dat nie są puste
            if(StartDate === '' || EndDate === '')
            {
                throw new Error('Błąd zakresu dat');
            }

            // sprawdzanie czy data początkowa jest większa od końcowej, jeśli tak to zamiana miejscami
            if(StartDate>EndDate)
                {
                    [StartDate, EndDate] = [EndDate, StartDate];
                }
            const startime = Date.parse(StartDate);
            const endtime = Date.parse(EndDate);//zamiana dat na milisekundy
           
        
            const tabela = generateDateRanges(startime, endtime);   // generowanie zakresów dat po 90 dni i mniej,(z tylu dni maksymalnie na raz można pobrać dane z api)        
            try {
                const data = await downloadDataFromAPI(tabela, option);//pobieranie danych z api 
                //console.log("Pobierane Dane", data);
                const processedData = processData(data,option)//przetwarzanie pobranych danych
                await convertToFileAndDowloadToComputer(processedData, StartDate, EndDate, option);// zamiana danych na plik JSON i pobranie go
            } catch (error) {
                console.error('Wystąpił błąd:', error);
            }
        });
        /**
         * Generuje zakresy dat o maksymalnej długości 90 dni między startRange a endRange.
         startRange - Początkowa data w milisekundach.
         endRange - Końcowa data w milisekundach.
         dateRanges - Tablica zakresów dat w milisekundach.
         tabela - Tablica zakresów dat.
         */
        function generateDateRanges(startRange, endRange) {
            const dateRanges = [];
            const ninetyDayInMilliseconds = 90 * 24 * 60 * 60 * 1000;
            const oneDayInMilliseconds = 1 * 24 * 60 * 60 * 1000;
            let currentStartDate = startRange;
        
            while (currentStartDate < endRange) {
                const currentEndDate = Math.min(currentStartDate + ninetyDayInMilliseconds, endRange);
                dateRanges.push([currentStartDate, currentEndDate]);
                currentStartDate += oneDayInMilliseconds;
                currentStartDate += ninetyDayInMilliseconds;
            }
            const tabela = parseMillisecondsToDate(dateRanges);//zamiana zakresów dat zapisanych w minisekundach na daty w odpowiednim formacie
            return tabela;
        }
        /*
          Konwertuje tablicę zakresów dat w milisekundach na format daty.
          array - Tablica zakresów dat w milisekundach.
          table - Tablica zakresów dat w formacie daty.
         */
        function parseMillisecondsToDate(array) {
            let table = [];
        
            for (let i = 0; i < array.length; i++) {
                for (let j = 0; j < array[i].length - 1; j++) {
                    const parseToDateStart = new Date(array[i][j]).toISOString().split('T')[0];
                    const parseToDateEnd = new Date(array[i][j + 1]).toISOString().split('T')[0];
                    table.push([parseToDateStart, parseToDateEnd]);
                }
            }
            return table;
        }
         /*
           Pobiera dane z API NBP dla podanych zakresów dat i opcji.
           array - Tablica zakresów dat w formacie daty.
           arrayOption - Opcja API (a, b, lub c).
           jsonDataTable - Tablica pobranych danych.
         */
        async function downloadDataFromAPI(array, arrayOption) {
            const jsonDataTable = [];
        
            for (let i = 0; i < array.length; i++) {
                for (let j = 0; j < array[i].length - 1; j++) {
                    //console.log(`VVV${array[i][j]},${array[i][j + 1]}`);
                    let zapytanie = `//api.nbp.pl/api/exchangerates/tables/${arrayOption}/${array[i][j]}/${array[i][j + 1]}/?format=json`;
        
                    try {
                        const res = await fetch(zapytanie);
                        if (res.ok) {
                            const data = await res.json();
                            jsonDataTable.push(...data);
                        } else {
                            throw new Error('Błąd pobierania danych z API');
                        }
                    } catch (err) {
                        console.log('błąd: ', err);
                    }
                }
            }
            return jsonDataTable;
        }
        /**
            Przetwarza pobrane dane na podstawie wybranej opcji.
            data - Tablica pobranych danych.
            option - Wybrana opcja (a, b, lub c).
            processedData - Tablica przetworzonych danych.
         */
        function processData(data, option) {
            const processedData = [];
        
            data.forEach(entry => {
                const effectiveDate = entry.effectiveDate;
        
                entry.rates.forEach(rate => {
                    const currencyCode = rate.code;
                    const currencyName = rate.country || rate.currency;
        
                    let value;
                    if (option === 'c') {
                        // Formatowanie danych dla tabeli typu 'c'
                        value = {
                            code: currencyCode,
                            currency: currencyName,
                            ask: rate.ask,
                            bid: rate.bid,
                            effectiveDate: effectiveDate
                        };
                    } else {
                        // Formatowanie danych dla tabeli typu 'a' lub 'b'
                        value = {
                            code: currencyCode,
                            currency: currencyName,
                            mid: rate.mid,
                            effectiveDate: effectiveDate
                        };
                    }
        
                    processedData.push(value);
                });
            });
        
            return processedData;
        }
        /**
           Konwertuje przetworzone dane do pliku JSON i pobiera go na komputer.
           jsonTable - Tablica przetworzonych danych.
           startDate, endDate, arrayOption - Parametry do nazwy pobieranego pliku 
         */
        async function convertToFileAndDowloadToComputer(jsonTable, startDate, endDate, arrayOption) {
            try {
                //console.log("Przekazana tablica", jsonTable);
                let jsonString = JSON.stringify(jsonTable,null,2);
               
                 const blob = new Blob([jsonString],{type: "application/json"} )
                 const url = URL.createObjectURL(blob)
        
                 const link = document.createElement('a')
                 link.href = url
                 link.download = `${startDate}_${endDate}_${arrayOption}_data.json`
                 document.body.appendChild(link)
                 link.click()
                 document.body.removeChild(link)
        
                 URL.revokeObjectURL(url)
            } catch (error) {
                console.error('Wystąpił błąd:', error);
            }
        }